/**
 * Priority Management Routes
 * Endpoints for managing and monitoring report priorities
 */

import express from 'express';
import {
  recalculateSinglePriority,
  calculatePriorityPreview,
  recalculateBatchPriorities,
  getPriorityStats,
  getReportsNeedingUpdate
} from '../controllers/priority.controllers.js';

const router = express.Router();

/**
 * @route   GET /api/priority/recalculate/:reportId
 * @desc    Manually recalculate and update priority for a single report
 * @access  Admin/Field Admin
 */
router.get('/recalculate/:reportId', recalculateSinglePriority);

/**
 * @route   GET /api/priority/calculate/:reportId
 * @desc    Calculate priority without saving (preview)
 * @access  Admin/Field Admin/Public
 */
router.get('/calculate/:reportId', calculatePriorityPreview);

/**
 * @route   POST /api/priority/recalculate-batch
 * @desc    Batch recalculate priorities for multiple reports
 * @body    { reportIds?: number[], onlyUnresolved?: boolean }
 * @access  Admin
 */
router.post('/recalculate-batch', recalculateBatchPriorities);

/**
 * @route   GET /api/priority/stats
 * @desc    Get priority distribution statistics
 * @query   onlyUnresolved=true|false
 * @access  Admin/Field Admin
 */
router.get('/stats', getPriorityStats);

/**
 * @route   GET /api/priority/needs-update
 * @desc    Get reports that need priority recalculation
 * @query   days=7, limit=50
 * @access  Admin/Field Admin
 */
router.get('/needs-update', getReportsNeedingUpdate);

export default router;
