/**
 * Priority Management Controller
 * Handles manual priority recalculation and monitoring
 */

import { query, transaction } from "../db/utils.js";
import {  calculateDynamicPriority,
  updateReportPriority,
  batchRecalculatePriorities
} from "../services/priorityCalculation.js";
import redisService from "../services/redis.js";

/**
 * Manually recalculate priority for a single report
 * GET /api/priority/recalculate/:reportId
 */
export const recalculateSinglePriority = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required"
      });
    }
    
    console.log(`🔄 Manual priority recalculation requested for report ${reportId}`);
    
    const result = await transaction(async (client) => {
      return await updateReportPriority(client, reportId);
    });
    
    // Invalidate cache
    await redisService.invalidatePattern('reports:*');
    await redisService.invalidatePattern('admin:*');
    
    res.status(200).json({
      success: true,
      message: "Priority recalculated successfully",
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error recalculating priority:', error);
    res.status(500).json({
      success: false,
      message: "Failed to recalculate priority",
      error: error.message
    });
  }
};

/**
 * Get priority calculation details without updating
 * GET /api/priority/calculate/:reportId
 */
export const calculatePriorityPreview = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required"
      });
    }
    
    console.log(`👁️ Priority calculation preview for report ${reportId}`);
    
    const result = await transaction(async (client) => {
      return await calculateDynamicPriority(client, reportId);
    });
    
    res.status(200).json({
      success: true,
      message: "Priority calculated (preview only, not saved)",
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error calculating priority:', error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate priority",
      error: error.message
    });
  }
};

/**
 * Batch recalculate priorities for multiple reports
 * POST /api/priority/recalculate-batch
 * Body: { reportIds?: number[], onlyUnresolved?: boolean }
 */
export const recalculateBatchPriorities = async (req, res) => {
  try {
    const { reportIds, onlyUnresolved = true } = req.body;
    
    console.log(`🔄 Batch priority recalculation requested`);
    console.log(`   Report IDs: ${reportIds ? reportIds.length : 'ALL'}`);
    console.log(`   Only unresolved: ${onlyUnresolved}`);
    
    const result = await transaction(async (client) => {
      return await batchRecalculatePriorities(client, reportIds, onlyUnresolved);
    });
    
    // Invalidate cache
    await redisService.invalidatePattern('reports:*');
    await redisService.invalidatePattern('admin:*');
    
    res.status(200).json({
      success: true,
      message: `Batch recalculation complete: ${result.successCount} updated, ${result.failCount} failed`,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error in batch recalculation:', error);
    res.status(500).json({
      success: false,
      message: "Failed to batch recalculate priorities",
      error: error.message
    });
  }
};

/**
 * Get priority statistics
 * GET /api/priority/stats
 */
export const getPriorityStats = async (req, res) => {
  try {
    const { onlyUnresolved = true } = req.query;
    
    const statsQuery = `
      SELECT 
        priority,
        COUNT(*) as count,
        ROUND(AVG(priority_score), 2) as avg_score,
        MIN(priority_score) as min_score,
        MAX(priority_score) as max_score,
        COUNT(CASE WHEN is_resolved THEN 1 END) as resolved_count,
        COUNT(CASE WHEN NOT is_resolved THEN 1 END) as unresolved_count
      FROM reports
      ${onlyUnresolved === 'true' ? 'WHERE is_resolved = false' : ''}
      GROUP BY priority
      ORDER BY 
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END
    `;
    
    const result = await query(statsQuery);
    
    // Calculate totals
    const totals = result.rows.reduce((acc, row) => {
      acc.totalReports += parseInt(row.count);
      acc.resolvedCount += parseInt(row.resolved_count);
      acc.unresolvedCount += parseInt(row.unresolved_count);
      return acc;
    }, { totalReports: 0, resolvedCount: 0, unresolvedCount: 0 });
    
    // Get recent priority updates
    const recentUpdatesQuery = `
      SELECT 
        id,
        title,
        priority,
        priority_score,
        priority_updated_at,
        created_at,
        is_resolved
      FROM reports
      WHERE priority_updated_at IS NOT NULL
      ORDER BY priority_updated_at DESC
      LIMIT 10
    `;
    
    const recentUpdates = await query(recentUpdatesQuery);
    
    res.status(200).json({
      success: true,
      data: {
        distribution: result.rows,
        totals,
        recentUpdates: recentUpdates.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching priority stats:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch priority statistics",
      error: error.message
    });
  }
};

/**
 * Get reports that need priority recalculation
 * Reports that haven't been updated in a while
 * GET /api/priority/needs-update
 */
export const getReportsNeedingUpdate = async (req, res) => {
  try {
    const { days = 7, limit = 50 } = req.query;
    
    const needsUpdateQuery = `
      SELECT 
        id,
        title,
        priority,
        priority_score,
        priority_updated_at,
        created_at,
        is_resolved,
        category
      FROM reports
      WHERE is_resolved = false
        AND (
          priority_updated_at IS NULL 
          OR priority_updated_at < NOW() - ($1 || ' days')::interval
        )
      ORDER BY 
        CASE 
          WHEN priority_updated_at IS NULL THEN 0
          ELSE 1
        END,
        priority_updated_at ASC NULLS FIRST
      LIMIT $2
    `;
    
    const result = await query(needsUpdateQuery, [days, limit]);
    
    res.status(200).json({
      success: true,
      message: `Found ${result.rows.length} reports needing priority update`,
      data: {
        reports: result.rows,
        count: result.rows.length,
        criteria: `Not updated in ${days} days`
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching reports needing update:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports needing update",
      error: error.message
    });
  }
};

export default {
  recalculateSinglePriority,
  calculatePriorityPreview,
  recalculateBatchPriorities,
  getPriorityStats,
  getReportsNeedingUpdate
};
