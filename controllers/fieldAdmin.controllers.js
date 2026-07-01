import { query, queryOne, transaction } from "../db/utils.js";
import { uploadBufferToCloudinary } from "../services/cloudinary.js";
import redisService from "../services/redis.js";
import { sendWhatsAppMessage, sendWhatsAppImage } from "../services/whatsappService.js";

// Helper to convert DB timestamp values to ISO strings (null-safe)
const toISO = (val) => (val ? new Date(val).toISOString() : null);

/**
 * Status mapping for Field Admin App
 * Database status -> Display status for field admin
 * - 'assigned' becomes 'pending' (newly assigned work appears as pending for field admin)
 * - 'in_progress' stays 'in_progress'
 * - 'resolved' becomes 'completed' for clarity
 */
const getFieldAdminDisplayStatus = (dbStatus) => {
    const statusMap = {
        'assigned': 'pending',        // Assigned reports show as pending for field admin
        'pending': 'pending',         // Unassigned pending stays pending
        'in_progress': 'in_progress', // In progress stays the same
        'resolved': 'completed',      // Resolved shows as completed
        'rejected': 'rejected'        // Rejected stays the same
    };
    return statusMap[dbStatus] || dbStatus;
};

// Get reports assigned to a specific field admin
export const getAssignedReports = async (req, res) => {
    try {
        const { adminId } = req.params;
        const { status, priority, category } = req.query;

        let queryText = `
            SELECT 
                r.*,
                u.id as user_id,
                u.full_name as user_full_name,
                u.phone_number as user_phone_number,
                u.email as user_email,
                COALESCE(sp.upvotes, 0) as upvotes,
                COALESCE(sp.downvotes, 0) as downvotes,
                COALESCE(sp.view_count, 0) as view_count,
                COALESCE(sp.share_count, 0) as share_count
            FROM reports r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN social_posts sp ON r.id = sp.report_id
            WHERE r.assigned_admin_id = $1
        `;

        const params = [adminId];
        let paramCount = 1;

        if (status) {
            paramCount++;
            queryText += ` AND r.status = $${paramCount}`;
            params.push(status);
        }

        if (priority) {
            paramCount++;
            queryText += ` AND r.priority = $${paramCount}`;
            params.push(priority);
        }

        if (category) {
            paramCount++;
            queryText += ` AND r.category = $${paramCount}`;
            params.push(category);
        }

        queryText += ` ORDER BY 
            CASE r.priority
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END,
            r.created_at DESC
        `;

        const result = await query(queryText, params);
        const reports = result.rows || [];

        const formattedReports = reports.map(r => ({
            id: r.id,
            userId: r.user_id,
            title: r.title,
            description: r.description,
            category: r.category,
            priority: r.priority,
            status: r.status,                            // Actual database status
            displayStatus: getFieldAdminDisplayStatus(r.status), // Display status for field admin app
            mediaUrls: r.media_urls || [],
            audioUrl: r.audio_url,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
            address: r.address,
            department: r.department,
            assignedAdminId: r.assigned_admin_id,
            isResolved: r.is_resolved,
            resolvedAt: toISO(r.resolved_at),
            resolvedBy: r.resolved_by_admin_id,
            resolvedPhotos: r.resolved_media_urls || [],
            resolvedNotes: r.resolution_note,
            createdAt: toISO(r.created_at),
            updatedAt: toISO(r.updated_at),
            upvotes: r.upvotes || 0,
            downvotes: r.downvotes || 0,
            viewCount: r.view_count || 0,
            shareCount: r.share_count || 0,
            inProgressAt: toISO(r.in_progress_at),
            inProgressPhotos: r.in_progress_photos || [],
            workStartedAt: toISO(r.work_started_at),
            workCompletedAt: toISO(r.work_completed_at),
            timeSpentMinutes: r.time_spent_minutes,
            user: r.user_id ? {
                id: r.user_id,
                fullName: r.user_full_name,
                phoneNumber: r.user_phone_number,
                email: r.user_email,
            } : null,
        }));

        return res.status(200).json({
            success: true,
            data: formattedReports
        });

    } catch (error) {
        console.error('❌ Error fetching assigned reports:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get detailed report information
export const getReportDetails = async (req, res) => {
    try {
        const { reportId } = req.params;

        const reportQuery = `
            SELECT 
                r.*,
                u.id as user_id,
                u.full_name as user_full_name,
                u.phone_number as user_phone_number,
                u.email as user_email,
                a.full_name as admin_full_name,
                COALESCE(sp.upvotes, 0) as upvotes,
                COALESCE(sp.downvotes, 0) as downvotes,
                COALESCE(sp.view_count, 0) as view_count,
                COALESCE(sp.share_count, 0) as share_count
            FROM reports r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN admins a ON r.assigned_admin_id = a.id
            LEFT JOIN social_posts sp ON r.id = sp.report_id
            WHERE r.id = $1
        `;

        const report = await queryOne(reportQuery, [reportId]);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        const formattedReport = {
            id: report.id,
            userId: report.user_id,
            title: report.title,
            description: report.description,
            category: report.category,
            priority: report.priority,
            status: report.status,                            // Actual database status
            displayStatus: getFieldAdminDisplayStatus(report.status), // Display status for field admin app
            mediaUrls: report.media_urls || [],
            audioUrl: report.audio_url,
            latitude: parseFloat(report.latitude),
            longitude: parseFloat(report.longitude),
            address: report.address,
            department: report.department,
            assignedAdminId: report.assigned_admin_id,
            isResolved: report.is_resolved,
            resolvedAt: toISO(report.resolved_at),
            resolvedBy: report.resolved_by_admin_id,
            resolvedPhotos: report.resolved_media_urls || [],
            resolvedNotes: report.resolution_note,
            createdAt: toISO(report.created_at),
            updatedAt: toISO(report.updated_at),
            upvotes: report.upvotes || 0,
            downvotes: report.downvotes || 0,
            viewCount: report.view_count || 0,
            shareCount: report.share_count || 0,
            inProgressAt: toISO(report.in_progress_at),
            inProgressPhotos: report.in_progress_photos || [],
            workStartedAt: toISO(report.work_started_at),
            workCompletedAt: toISO(report.work_completed_at),
            timeSpentMinutes: report.time_spent_minutes,
            user: report.user_id ? {
                id: report.user_id,
                fullName: report.user_full_name,
                phoneNumber: report.user_phone_number,
                email: report.user_email,
            } : null,
            assignedAdmin: report.admin_full_name,
        };

        return res.status(200).json({
            success: true,
            data: formattedReport
        });

    } catch (error) {
        console.error('❌ Error fetching report details:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Mark report as in-progress
export const startWork = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { adminId, notes, latitude, longitude } = req.body;

        const updatedReport = await transaction(async (client) => {
            // Update report status
            const updateQuery = `
                UPDATE reports
                SET status = 'in_progress',
                    in_progress_at = CURRENT_TIMESTAMP,
                    work_started_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND assigned_admin_id = $2
                RETURNING *
            `;

            const result = await client.query(updateQuery, [reportId, adminId]);

            if (result.rows.length === 0) {
                throw new Error('Report not found or not assigned to this admin');
            }

            // Create work log entry
            const logQuery = `
                INSERT INTO work_logs (report_id, admin_id, action, notes, location_lat, location_lng)
                VALUES ($1, $2, 'started', $3, $4, $5)
            `;

            await client.query(logQuery, [reportId, adminId, notes || 'Work started', latitude, longitude]);

            return result.rows[0];
        });

        // Invalidate caches so all platforms see the status change
        try {
            await redisService.invalidateAdminReports();
            
            // Invalidate user reports cache
            const userId = updatedReport.user_id;
            if (userId) {
                const userCachePattern = `user_reports:${userId}:*`;
                const userKeys = await redisService.scanKeys(userCachePattern);
                if (userKeys.length > 0) {
                    await redisService.del(userKeys);
                    console.log(`🗑️ Invalidated ${userKeys.length} user report cache entries`);
                }
            }
            console.log('🧹 Cache invalidation completed for startWork');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate caches:', cacheError.message);
        }

        return res.status(200).json({
            success: true,
            message: "Report marked as in progress",
            data: updatedReport
        });

    } catch (error) {
        console.error('❌ Error starting work:', error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

// Add progress update to report
export const addProgressUpdate = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { adminId, notes, latitude, longitude } = req.body;

        // Upload photos if any
        let photoUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await uploadBufferToCloudinary(file.buffer);
                if (result?.url) {
                    photoUrls.push(result.url);
                }
            }
        }

        await transaction(async (client) => {
            // Add photos to report's in_progress_photos array
            if (photoUrls.length > 0) {
                const updateQuery = `
                    UPDATE reports
                    SET in_progress_photos = COALESCE(in_progress_photos, '{}') || $1::text[],
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `;
                await client.query(updateQuery, [photoUrls, reportId]);
            }

            // Create work log entry
            const logQuery = `
                INSERT INTO work_logs (report_id, admin_id, action, notes, photos, location_lat, location_lng)
                VALUES ($1, $2, 'in_progress_update', $3, $4, $5, $6)
            `;

            await client.query(logQuery, [reportId, adminId, notes, photoUrls, latitude, longitude]);
        });

        return res.status(200).json({
            success: true,
            message: "Progress update added",
            data: { photoUrls }
        });

    } catch (error) {
        console.error('❌ Error adding progress update:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Mark report as complete/resolved
export const completeReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { adminId, resolvedNotes, resolvedPhotos, timeSpentMinutes, materialsUsed } = req.body;

        console.log('🔧 Completing report:', reportId, 'by admin:', adminId);
        console.log('📸 Resolved photos:', resolvedPhotos);

        // Handle resolved photos - accept array from body or file uploads
        let finalResolvedPhotos = [];
        
        // First priority: photos from body (already uploaded URLs)
        if (resolvedPhotos && Array.isArray(resolvedPhotos)) {
            finalResolvedPhotos = resolvedPhotos;
        }
        // Fallback: upload files if provided
        else if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await uploadBufferToCloudinary(file.buffer);
                if (result?.url) {
                    finalResolvedPhotos.push(result.url);
                }
            }
        }

        const updatedReport = await transaction(async (client) => {
            // First, get the report to calculate time_taken_to_resolve
            const getReportQuery = `
                SELECT created_at, work_started_at, in_progress_at
                FROM reports
                WHERE id = $1 AND assigned_admin_id = $2
            `;
            
            const reportResult = await client.query(getReportQuery, [reportId, adminId]);
            
            if (reportResult.rows.length === 0) {
                throw new Error('Report not found or not assigned to this admin');
            }

            const report = reportResult.rows[0];
            const now = new Date();
            
            // Calculate time_taken_to_resolve (from creation to resolution) in minutes
            const createdAt = new Date(report.created_at);
            const timeTakenToResolveMinutes = Math.round((now - createdAt) / (1000 * 60));
            
            // Calculate time_spent_minutes (from work start to completion)
            let calculatedTimeSpent = timeSpentMinutes;
            if (!calculatedTimeSpent && report.work_started_at) {
                const workStartedAt = new Date(report.work_started_at);
                calculatedTimeSpent = Math.round((now - workStartedAt) / (1000 * 60));
            } else if (!calculatedTimeSpent && report.in_progress_at) {
                const inProgressAt = new Date(report.in_progress_at);
                calculatedTimeSpent = Math.round((now - inProgressAt) / (1000 * 60));
            }

            console.log('⏱️  Time calculations:', {
                timeTakenToResolveMinutes,
                calculatedTimeSpent,
                createdAt: report.created_at,
                workStartedAt: report.work_started_at
            });

            // Update report to resolved
            const updateQuery = `
                UPDATE reports
                SET status = 'resolved',
                    is_resolved = true,
                    resolved_at = CURRENT_TIMESTAMP,
                    resolved_by_admin_id = $1,
                    resolution_note = $2,
                    resolved_media_urls = $3,
                    work_completed_at = CURRENT_TIMESTAMP,
                    time_spent_minutes = $4,
                    time_taken_to_resolve = $5,
                    materials_used = $6,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $7 AND assigned_admin_id = $1
                RETURNING *
            `;

            const result = await client.query(updateQuery, [
                adminId,
                resolvedNotes,
                finalResolvedPhotos,
                calculatedTimeSpent,
                timeTakenToResolveMinutes,
                materialsUsed || null,
                reportId
            ]);

            if (result.rows.length === 0) {
                throw new Error('Report not found or not assigned to this admin');
            }

            // Create work log entry
            const logQuery = `
                INSERT INTO work_logs (report_id, admin_id, action, notes, photos)
                VALUES ($1, $2, 'completed', $3, $4)
            `;

            await client.query(logQuery, [reportId, adminId, resolvedNotes, finalResolvedPhotos]);

            return result.rows[0];
        });

        console.log('✅ Report completed successfully');

        // Send WhatsApp notification
        try {
            if (updatedReport && updatedReport.user_id) {
                const user = await queryOne(`SELECT phone_number, full_name FROM users WHERE id = $1`, [updatedReport.user_id]);
                if (user && user.phone_number) {
                    const title = updatedReport.title || 'Report';
                    const notes = updatedReport.resolution_note || 'No resolution details provided.';
                    
                    let messageText = `🔔 *Jan Setu Update*\n\n`;
                    messageText += `Hello *${user.full_name || 'Citizen'}*,\n\n`;
                    messageText += `Your report *"${title}"* has been successfully resolved! 🎉\n\n`;
                    messageText += `*Resolution Details:*\n`;
                    messageText += `"${notes}"\n\n`;
                    messageText += `Thank you for using Jan Setu to help improve our community.`;

                    sendWhatsAppMessage(user.phone_number, messageText)
                        .then(async (success) => {
                            if (success) {
                                console.log('✅ WhatsApp message sent for resolved report:', reportId);
                                
                                // Send resolved photos if any exist
                                if (finalResolvedPhotos && finalResolvedPhotos.length > 0) {
                                    console.log(`📸 [whatsappService] Sending ${finalResolvedPhotos.length} resolution photos to user...`);
                                    for (let i = 0; i < finalResolvedPhotos.length; i++) {
                                        const photoUrl = finalResolvedPhotos[i];
                                        const caption = `Resolution Photo ${i + 1} for: *"${title}"*`;
                                        await sendWhatsAppImage(user.phone_number, photoUrl, caption);
                                    }
                                }
                            } else {
                                console.warn('⚠️ WhatsApp message failed for resolved report:', reportId);
                            }
                        })
                        .catch(err => console.error('❌ WhatsApp send error:', err));
                }
            }
        } catch (waError) {
            console.error('⚠️ Failed to initiate WhatsApp notification:', waError);
        }

        // Invalidate caches so all platforms see the completion
        try {
            await redisService.invalidateAdminReports();
            
            // Invalidate user reports cache
            const userId = updatedReport.user_id;
            if (userId) {
                const userCachePattern = `user_reports:${userId}:*`;
                const userKeys = await redisService.scanKeys(userCachePattern);
                if (userKeys.length > 0) {
                    await redisService.del(userKeys);
                    console.log(`🗑️ Invalidated ${userKeys.length} user report cache entries`);
                }
            }
            console.log('🧹 Cache invalidation completed for completeReport');
        } catch (cacheError) {
            console.warn('⚠️ Failed to invalidate caches:', cacheError.message);
        }

        return res.status(200).json({
            success: true,
            message: "Report marked as resolved",
            data: updatedReport
        });

    } catch (error) {
        console.error('❌ Error completing report:', error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

// Get dashboard statistics for field admin
export const getDashboardStats = async (req, res) => {
    try {
        const { adminId } = req.params;

        // For field admin: 'assigned' and 'pending' both count as "pending work"
        const statsQuery = `
            SELECT 
                COUNT(*) as total_assigned,
                COUNT(*) FILTER (WHERE status IN ('pending', 'assigned')) as pending,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                COUNT(*) FILTER (WHERE is_resolved = true AND DATE(resolved_at) = CURRENT_DATE) as completed_today,
                COUNT(*) FILTER (WHERE is_resolved = true AND resolved_at >= CURRENT_DATE - INTERVAL '7 days') as completed_this_week,
                COUNT(*) FILTER (WHERE is_resolved = true AND resolved_at >= CURRENT_DATE - INTERVAL '30 days') as completed_this_month,
                AVG(time_spent_minutes) FILTER (WHERE time_spent_minutes IS NOT NULL) as avg_time_spent
            FROM reports
            WHERE assigned_admin_id = $1
        `;

        const categoryQuery = `
            SELECT category, COUNT(*) as count
            FROM reports
            WHERE assigned_admin_id = $1 AND is_resolved = false
            GROUP BY category
            ORDER BY count DESC
        `;

        const [stats, categoriesResult] = await Promise.all([
            queryOne(statsQuery, [adminId]),
            query(categoryQuery, [adminId])
        ]);

        const categories = categoriesResult.rows || [];

        return res.status(200).json({
            success: true,
            data: {
                totalAssigned: parseInt(stats.total_assigned) || 0,
                pending: parseInt(stats.pending) || 0,
                inProgress: parseInt(stats.in_progress) || 0,
                completedToday: parseInt(stats.completed_today) || 0,
                completedThisWeek: parseInt(stats.completed_this_week) || 0,
                completedThisMonth: parseInt(stats.completed_this_month) || 0,
                avgTimeSpent: parseFloat(stats.avg_time_spent) || 0,
                categoryBreakdown: categories.map(c => ({
                    category: c.category,
                    count: parseInt(c.count)
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get today's reports for field admin
export const getTodayReports = async (req, res) => {
    try {
        const { adminId } = req.params;

        const queryText = `
            SELECT 
                r.*,
                u.full_name as user_full_name,
                u.phone_number as user_phone_number
            FROM reports r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.assigned_admin_id = $1 
            AND DATE(r.created_at) = CURRENT_DATE
            ORDER BY 
                CASE r.priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                r.created_at DESC
        `;

        const result = await query(queryText, [adminId]);
        const reports = result.rows || [];

        const formattedReports = reports.map(r => ({
            id: r.id,
            userId: r.user_id,
            title: r.title,
            description: r.description,
            category: r.category,
            priority: r.priority,
            status: r.status,
            latitude: parseFloat(r.latitude),
            longitude: parseFloat(r.longitude),
            address: r.address,
            createdAt: toISO(r.created_at),
            user: {
                fullName: r.user_full_name,
                phoneNumber: r.user_phone_number
            }
        }));

        return res.status(200).json({
            success: true,
            data: formattedReports
        });

    } catch (error) {
        console.error('❌ Error fetching today\'s reports:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Upload work photo
export const uploadWorkPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        const result = await uploadBufferToCloudinary(req.file.buffer);

        if (!result || !result.url) {
            return res.status(500).json({
                success: false,
                message: "Failed to upload photo"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                url: result.url
            }
        });

    } catch (error) {
        console.error('❌ Error uploading work photo:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Update admin location (for team tracking)
export const updateAdminLocation = async (req, res) => {
    try {
        const { adminId, latitude, longitude } = req.body;

        const updateQuery = `
            INSERT INTO admin_locations (admin_id, latitude, longitude, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (admin_id) 
            DO UPDATE SET 
                latitude = $2,
                longitude = $3,
                updated_at = CURRENT_TIMESTAMP
        `;

        await query(updateQuery, [adminId, latitude, longitude]);

        return res.status(200).json({
            success: true,
            message: "Location updated successfully"
        });

    } catch (error) {
        console.error('❌ Error updating admin location:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Get team member locations
export const getTeamLocations = async (req, res) => {
    try {
        const { department } = req.query;

        let queryText = `
            SELECT 
                a.id,
                a.full_name,
                a.department,
                al.latitude,
                al.longitude,
                al.updated_at
            FROM admins a
            INNER JOIN admin_locations al ON a.id = al.admin_id
            WHERE a.is_active = true
            AND al.updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
        `;

        const params = [];

        if (department) {
            queryText += ` AND a.department = $1`;
            params.push(department);
        }

        const locations = await query(queryText, params);

        return res.status(200).json({
            success: true,
            data: locations.map(l => ({
                adminId: l.id,
                name: l.full_name,
                department: l.department,
                latitude: parseFloat(l.latitude),
                longitude: parseFloat(l.longitude),
                lastUpdated: toISO(l.updated_at)
            }))
        });

    } catch (error) {
        console.error('❌ Error fetching team locations:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
