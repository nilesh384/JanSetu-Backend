/**
 * Dynamic Priority Calculation Service
 * 
 * Calculates and updates report priorities based on multiple factors:
 * - Location-based clustering (nearby reports)
 * - Category severity
 * - Community engagement (likes, views, shares, comments)
 * - Time decay (older unresolved reports get higher priority)
 * - Media evidence quality
 * - Status and resolution time
 * 
 * Priority Score: 0-100 (numeric)
 * Priority Level: low | medium | high | critical (categorical)
 */

import { query, queryOne } from "../db/utils.js";

/**
 * Category severity configuration
 * Higher weight = higher base priority
 */
const CATEGORY_WEIGHTS = {
  'Public Safety & Emergency': 3.0,
  'Water Supply & Sewerage': 2.8,
  'Traffic & Transport': 2.5,
  'Municipal Urban Planning & Encroachment Removal': 2.3,
  'Street Lighting & Electrical': 2.0,
  'Roads & Infrastructure': 1.8,
  'Public Health & Hygiene': 1.7,
  'Environmental Issues': 1.5,
  'Waste Management': 1.4,
  'Parks & Recreation': 1.2,
  'Other': 1.0
};

/**
 * Calculate location-based clustering score
 * More nearby unresolved reports = higher priority
 */
const calculateClusteringScore = async (client, latitude, longitude, reportId, radiusMeters = 500, days = 30) => {
  try {
    const nearbyQuery = `
      SELECT COUNT(*) AS cnt
      FROM reports
      WHERE id != $1
        AND is_resolved = false
        AND created_at >= NOW() - ($4 || ' days')::interval
        AND (
          6371000 * acos(
            LEAST(1, cos(radians($2)) * cos(radians(latitude)) * cos(radians(longitude) - radians($3))
            + sin(radians($2)) * sin(radians(latitude)))
          )
        ) <= $5
    `;
    
    const result = await client.query(nearbyQuery, [reportId, latitude, longitude, days, radiusMeters]);
    const nearbyCount = parseInt(result.rows[0]?.cnt || 0, 10);
    
    // Score: 0-20 points based on nearby reports
    // 0 nearby = 0 points, 10+ nearby = 20 points
    return Math.min(nearbyCount * 2, 20);
  } catch (error) {
    console.warn('⚠️ Clustering score calculation failed:', error);
    return 0;
  }
};

/**
 * Calculate community engagement score
 * Based on social interactions (likes, comments, views, shares)
 */
const calculateEngagementScore = async (client, reportId) => {
  try {
    const engagementQuery = `
      SELECT 
        COALESCE(sp.upvotes, 0) as upvotes,
        COALESCE(sp.downvotes, 0) as downvotes,
        COALESCE(sp.total_score, 0) as total_score,
        COALESCE(sp.comment_count, 0) as comment_count,
        COALESCE(sp.view_count, 0) as view_count,
        COALESCE(sp.share_count, 0) as share_count
      FROM reports r
      LEFT JOIN social_posts sp ON sp.report_id = r.id
      WHERE r.id = $1
    `;
    
    const result = await client.query(engagementQuery, [reportId]);
    if (!result.rows[0]) return 0;
    
    const { upvotes, downvotes, comment_count, view_count, share_count } = result.rows[0];
    
    // Calculate weighted engagement score (0-25 points)
    // Net votes: upvotes - downvotes (max 10 points)
    const netVotes = Math.max(0, upvotes - downvotes);
    const voteScore = Math.min(netVotes * 1, 10);
    
    // Comments show active discussion (max 8 points)
    const commentScore = Math.min(comment_count * 0.5, 8);
    
    // Views show visibility (max 4 points)
    const viewScore = Math.min(view_count * 0.01, 4);
    
    // Shares amplify reach (max 3 points)
    const shareScore = Math.min(share_count * 1, 3);
    
    const totalEngagement = voteScore + commentScore + viewScore + shareScore;
    
    console.log(`📊 Engagement breakdown: votes=${voteScore.toFixed(1)}, comments=${commentScore.toFixed(1)}, views=${viewScore.toFixed(1)}, shares=${shareScore.toFixed(1)} → ${totalEngagement.toFixed(1)}`);
    
    return totalEngagement;
  } catch (error) {
    console.warn('⚠️ Engagement score calculation failed:', error);
    return 0;
  }
};

/**
 * Calculate time decay score
 * Older unresolved reports get higher priority over time
 */
const calculateTimeDecayScore = async (client, reportId) => {
  try {
    const timeQuery = `
      SELECT 
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 AS days_old,
        is_resolved
      FROM reports
      WHERE id = $1
    `;
    
    const result = await client.query(timeQuery, [reportId]);
    if (!result.rows[0]) return 0;
    
    const { days_old, is_resolved } = result.rows[0];
    
    // Parse days_old as number
    const daysOld = parseFloat(days_old) || 0;
    
    // Resolved reports don't get time decay boost
    if (is_resolved) return 0;
    
    // Score increases over time (0-20 points)
    // 0-7 days: 0-5 points (slow increase)
    // 7-30 days: 5-15 points (moderate increase)
    // 30+ days: 15-20 points (steep increase, capped)
    
    let timeScore = 0;
    if (daysOld <= 7) {
      timeScore = daysOld * 0.7; // 0-5 points
    } else if (daysOld <= 30) {
      timeScore = 5 + ((daysOld - 7) * 0.4); // 5-15 points
    } else {
      timeScore = 15 + Math.min((daysOld - 30) * 0.2, 5); // 15-20 points (capped)
    }
    
    console.log(`⏰ Time decay: ${daysOld.toFixed(1)} days old → ${timeScore.toFixed(1)} points`);
    
    return timeScore;
  } catch (error) {
    console.warn('⚠️ Time decay calculation failed:', error);
    return 0;
  }
};

/**
 * Calculate media evidence score
 * Reports with photos/videos are more credible
 */
const calculateMediaScore = async (client, reportId) => {
  try {
    const mediaQuery = `
      SELECT media_urls, audio_url
      FROM reports
      WHERE id = $1
    `;
    
    const result = await client.query(mediaQuery, [reportId]);
    if (!result.rows[0]) return 0;
    
    const { media_urls, audio_url } = result.rows[0];
    
    // Parse array fields (handle PostgreSQL array format)
    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/^{|}$/g, '').trim();
        return cleaned ? cleaned.split(',').map(item => item.replace(/^"|"$/g, '').trim()).filter(Boolean) : [];
      }
      return [];
    };
    
    const mediaFiles = parseArray(media_urls);
    const hasAudio = !!audio_url;
    
    // Score: 0-10 points
    // Media files (photos/videos): 2 points each (max 8)
    // Audio: 2 points
    const mediaScore = Math.min(mediaFiles.length * 2, 8);
    const audioScore = hasAudio ? 2 : 0;
    
    return mediaScore + audioScore;
  } catch (error) {
    console.warn('⚠️ Media score calculation failed:', error);
    return 0;
  }
};

/**
 * Calculate admin interaction score
 * Reports that admins have interacted with get a boost
 */
const calculateAdminInteractionScore = async (client, reportId) => {
  try {
    const interactionQuery = `
      SELECT 
        status,
        assigned_admin_id,
        resolved_by_admin_id,
        resolution_note
      FROM reports
      WHERE id = $1
    `;
    
    const result = await client.query(interactionQuery, [reportId]);
    if (!result.rows[0]) return 0;
    
    const { status, assigned_admin_id, resolved_by_admin_id, resolution_note } = result.rows[0];
    
    let score = 0;
    
    // Status indicates admin attention (0-5 points)
    const statusScores = {
      'pending': 0,
      'under_review': 2,
      'assigned': 3,
      'in_progress': 4,
      'resolved': 0, // Resolved gets 0 to lower priority
      'rejected': -5 // Rejected gets negative
    };
    score += statusScores[status] || 0;
    
    // Assigned to admin (2 points)
    if (assigned_admin_id) {
      score += 2;
    }
    
    // Has resolution note (1 point)
    if (resolution_note && resolution_note.trim()) {
      score += 1;
    }
    
    return Math.max(0, score); // Ensure non-negative
  } catch (error) {
    console.warn('⚠️ Admin interaction score calculation failed:', error);
    return 0;
  }
};

/**
 * Main function to calculate dynamic priority score
 * Returns both numeric score (0-100) and categorical priority
 */
export const calculateDynamicPriority = async (client, reportId) => {
  try {
    console.log(`\n🎯 Calculating dynamic priority for report ${reportId}`);
    
    // Get basic report info
    const reportQuery = `
      SELECT 
        id, latitude, longitude, category, is_resolved, created_at
      FROM reports
      WHERE id = $1
    `;
    const result = await client.query(reportQuery, [reportId]);
    
    if (!result.rows[0]) {
      throw new Error('Report not found');
    }
    
    const report = result.rows[0];
    
    // If resolved, return minimal priority
    if (report.is_resolved) {
      console.log('✅ Report is resolved - setting minimal priority');
      return {
        priorityScore: 10,
        priority: 'low'
      };
    }
    
    // Calculate component scores
    const [
      clusteringScore,
      engagementScore,
      timeDecayScore,
      mediaScore,
      adminScore
    ] = await Promise.all([
      calculateClusteringScore(client, report.latitude, report.longitude, reportId),
      calculateEngagementScore(client, reportId),
      calculateTimeDecayScore(client, reportId),
      calculateMediaScore(client, reportId),
      calculateAdminInteractionScore(client, reportId)
    ]);
    
    // Category base score (0-25 points)
    const categoryWeight = CATEGORY_WEIGHTS[report.category] || CATEGORY_WEIGHTS['Other'];
    const categoryScore = (categoryWeight / 3.0) * 25; // Normalize to 0-25
    
    // Calculate total score (0-100)
    const totalScore = Math.round(
      categoryScore +          // 0-25 points
      clusteringScore +        // 0-20 points
      engagementScore +        // 0-25 points
      timeDecayScore +         // 0-20 points
      mediaScore +             // 0-10 points
      adminScore               // 0-5 points (can be negative)
    );
    
    // Clamp between 0-100
    const priorityScore = Math.max(0, Math.min(100, totalScore));
    
    // Determine categorical priority based on score
    let priority;
    if (priorityScore >= 75) {
      priority = 'critical';
    } else if (priorityScore >= 50) {
      priority = 'high';
    } else if (priorityScore >= 25) {
      priority = 'medium';
    } else {
      priority = 'low';
    }
    
    console.log(`\n📊 Priority Score Breakdown:`);
    console.log(`   Category (${report.category}): ${categoryScore.toFixed(1)} pts`);
    console.log(`   Clustering: ${clusteringScore.toFixed(1)} pts`);
    console.log(`   Engagement: ${engagementScore.toFixed(1)} pts`);
    console.log(`   Time Decay: ${timeDecayScore.toFixed(1)} pts`);
    console.log(`   Media: ${mediaScore.toFixed(1)} pts`);
    console.log(`   Admin Interaction: ${adminScore.toFixed(1)} pts`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   TOTAL: ${priorityScore} pts → ${priority.toUpperCase()}\n`);
    
    return {
      priorityScore,
      priority,
      breakdown: {
        category: Math.round(categoryScore),
        clustering: Math.round(clusteringScore),
        engagement: Math.round(engagementScore),
        timeDecay: Math.round(timeDecayScore),
        media: Math.round(mediaScore),
        adminInteraction: Math.round(adminScore)
      }
    };
    
  } catch (error) {
    console.error('❌ Dynamic priority calculation failed:', error);
    throw error;
  }
};

/**
 * Update priority in database
 */
export const updateReportPriority = async (client, reportId) => {
  try {
    const { priorityScore, priority, breakdown } = await calculateDynamicPriority(client, reportId);
    
    const updateQuery = `
      UPDATE reports
      SET 
        priority = $1,
        priority_score = $2,
        priority_updated_at = NOW()
      WHERE id = $3
      RETURNING id, priority, priority_score
    `;
    
    const result = await client.query(updateQuery, [priority, priorityScore, reportId]);
    
    console.log(`✅ Updated priority for report ${reportId}: ${priority} (score: ${priorityScore})`);
    
    return {
      success: true,
      reportId,
      priority,
      priorityScore,
      breakdown
    };
    
  } catch (error) {
    console.error(`❌ Failed to update priority for report ${reportId}:`, error);
    throw error;
  }
};

/**
 * Batch recalculate priorities for multiple reports
 * Useful for periodic maintenance
 */
export const batchRecalculatePriorities = async (client, reportIds = null, onlyUnresolved = true) => {
  try {
    // If no specific IDs provided, get all reports (or just unresolved)
    let reportsToUpdate;
    
    if (reportIds) {
      reportsToUpdate = reportIds;
    } else {
      const query = onlyUnresolved 
        ? `SELECT id FROM reports WHERE is_resolved = false ORDER BY created_at DESC`
        : `SELECT id FROM reports ORDER BY created_at DESC`;
      
      const result = await client.query(query);
      reportsToUpdate = result.rows.map(r => r.id);
    }
    
    console.log(`🔄 Batch recalculating priorities for ${reportsToUpdate.length} reports...`);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const reportId of reportsToUpdate) {
      try {
        const result = await updateReportPriority(client, reportId);
        results.push(result);
        successCount++;
      } catch (error) {
        console.error(`Failed to update report ${reportId}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`✅ Batch update complete: ${successCount} succeeded, ${failCount} failed`);
    
    return {
      success: true,
      totalProcessed: reportsToUpdate.length,
      successCount,
      failCount,
      results
    };
    
  } catch (error) {
    console.error('❌ Batch priority recalculation failed:', error);
    throw error;
  }
};

export default {
  calculateDynamicPriority,
  updateReportPriority,
  batchRecalculatePriorities
};
