# 🎯 Dynamic Priority System Documentation

## Overview

The **Dynamic Priority System** intelligently calculates and updates report priorities based on multiple real-time factors, ensuring that the most critical issues get the attention they deserve.

### Key Features

✅ **Automatic Priority Calculation** - No need to manually set priorities  
✅ **Real-Time Updates** - Priority adjusts based on community engagement  
✅ **Multi-Factor Analysis** - Considers 6+ different factors  
✅ **Transparent Scoring** - 0-100 numeric score with detailed breakdown  
✅ **Background Processing** - Priority updates don't slow down user actions  
✅ **Batch Operations** - Recalculate multiple reports efficiently  

---

## 🧮 Priority Calculation Formula

### Numeric Score (0-100 points)

The system calculates a **Priority Score** from 0 to 100 based on these components:

| Factor | Weight | Max Points | Description |
|--------|--------|------------|-------------|
| **Category Severity** | Variable | 25 pts | Based on report category importance |
| **Location Clustering** | 2x nearby | 20 pts | More nearby unresolved reports = higher priority |
| **Community Engagement** | Weighted | 25 pts | Upvotes, comments, views, shares |
| **Time Decay** | Age-based | 20 pts | Older unresolved reports get priority boost |
| **Media Evidence** | Per item | 10 pts | Photos and videos increase credibility |
| **Admin Interaction** | Status-based | 5 pts | Admin attention indicates importance |

### Priority Levels (Categorical)

The numeric score is mapped to categorical priorities:

```
Score 75-100:  CRITICAL  🔴
Score 50-74:   HIGH      🟠
Score 25-49:   MEDIUM    🟡
Score 0-24:    LOW       🟢
```

---

## 📊 Detailed Factor Breakdown

### 1. Category Severity (0-25 points)

Categories are weighted based on their potential impact:

```javascript
Critical Categories (3.0x weight):
  • Public Safety & Emergency
  • Water Supply & Sewerage
  
High Priority Categories (2.5-2.8x weight):
  • Traffic & Transport
  • Municipal Urban Planning
  
Medium Priority Categories (1.7-2.0x weight):
  • Street Lighting & Electrical
  • Roads & Infrastructure
  • Public Health & Hygiene
  
Lower Priority Categories (1.0-1.5x weight):
  • Environmental Issues
  • Waste Management
  • Parks & Recreation
  • Other
```

**Calculation:**
```
categoryScore = (category_weight / 3.0) * 25
```

### 2. Location Clustering (0-20 points)

Groups similar reports in the same area:

- Searches for unresolved reports within **500 meters**
- Considers reports from the last **30 days**
- More nearby reports = higher priority

**Scoring:**
```
clusteringScore = Math.min(nearbyCount * 2, 20)
```

**Examples:**
- 0 nearby reports = 0 points
- 5 nearby reports = 10 points
- 10+ nearby reports = 20 points (capped)

### 3. Community Engagement (0-25 points)

Social interaction boosts priority:

**Components:**
- **Net Votes** (max 10 pts): `(upvotes - downvotes) * 1`
- **Comments** (max 8 pts): `comment_count * 0.5`
- **Views** (max 4 pts): `view_count * 0.01`
- **Shares** (max 3 pts): `share_count * 1`

**Example:**
```
Report with:
  - 15 upvotes, 3 downvotes = 12 net votes → 10 points
  - 10 comments → 5 points
  - 200 views → 2 points
  - 2 shares → 2 points
  Total Engagement: 19 points
```

### 4. Time Decay (0-20 points)

Older unresolved reports gain priority over time:

**Age-Based Scoring:**
```
0-7 days:   Slow increase (0-5 points)
7-30 days:  Moderate increase (5-15 points)
30+ days:   Steep increase (15-20 points, capped)
```

**Formula:**
```javascript
if (days_old <= 7) {
  timeScore = days_old * 0.7;
} else if (days_old <= 30) {
  timeScore = 5 + ((days_old - 7) * 0.4);
} else {
  timeScore = 15 + Math.min((days_old - 30) * 0.2, 5);
}
```

⚠️ **Note:** Resolved reports don't get time decay boost.

### 5. Media Evidence (0-10 points)

Visual proof increases credibility:

- **Photos**: 1 point each (max 6 points)
- **Videos**: 2 points each (max 4 points)

**Examples:**
- 3 photos = 3 points
- 1 video, 2 photos = 4 points
- 5 photos, 3 videos = 10 points (max)

### 6. Admin Interaction (0-5 points)

Admin attention indicates importance:

**Status-Based Points:**
```
pending:       0 points
under_review:  2 points
assigned:      3 points
in_progress:   4 points
resolved:      0 points
rejected:      -5 points (lowers priority)
```

**Additional Bonuses:**
- Assigned to admin/field admin: +2 points
- Has resolution notes: +1 point

---

## 🔄 Automatic Priority Updates

### Trigger Events

Priority is automatically recalculated when:

1. **User Votes** - Someone upvotes or downvotes the social post
2. **New Comments** - Discussion activity indicates importance
3. **Time Passes** - Scheduled batch updates (recommended daily)
4. **Status Changes** - Admin updates report status
5. **Media Added** - New photos/videos uploaded

### Background Processing

Priority updates run **asynchronously** to avoid slowing down user actions:

```javascript
// Priority update happens in background
transaction(async (client) => {
  await updateReportPriority(client, reportId);
}).catch(err => console.warn('⚠️ Priority recalculation failed:', err));

// User action completes immediately
return res.status(200).json({ success: true });
```

---

## 🔧 API Endpoints

### 1. Get Priority Preview (No Save)

```http
GET /api/v1/priority/calculate/:reportId
```

**Response:**
```json
{
  "success": true,
  "message": "Priority calculated (preview only, not saved)",
  "data": {
    "priorityScore": 67,
    "priority": "high",
    "breakdown": {
      "category": 21,
      "clustering": 14,
      "engagement": 18,
      "timeDecay": 10,
      "media": 4,
      "adminInteraction": 0
    }
  }
}
```

### 2. Recalculate Single Report

```http
GET /api/v1/priority/recalculate/:reportId
```

**Response:**
```json
{
  "success": true,
  "message": "Priority recalculated successfully",
  "data": {
    "reportId": 123,
    "priority": "high",
    "priorityScore": 67
  }
}
```

### 3. Batch Recalculation

```http
POST /api/v1/priority/recalculate-batch
Content-Type: application/json

{
  "reportIds": [123, 456, 789],  // Optional: specific IDs
  "onlyUnresolved": true           // Optional: default true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch recalculation complete: 147 updated, 3 failed",
  "data": {
    "totalProcessed": 150,
    "successCount": 147,
    "failCount": 3
  }
}
```

### 4. Get Priority Statistics

```http
GET /api/v1/priority/stats?onlyUnresolved=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "distribution": [
      {
        "priority": "critical",
        "count": 12,
        "avg_score": 82.5,
        "min_score": 75,
        "max_score": 95
      },
      // ... more priority levels
    ],
    "totals": {
      "totalReports": 450,
      "resolvedCount": 200,
      "unresolvedCount": 250
    },
    "recentUpdates": [
      // 10 most recently updated reports
    ]
  }
}
```

### 5. Get Reports Needing Update

```http
GET /api/v1/priority/needs-update?days=7&limit=50
```

**Response:**
```json
{
  "success": true,
  "message": "Found 32 reports needing priority update",
  "data": {
    "reports": [
      // Reports not updated in 7 days
    ],
    "count": 32,
    "criteria": "Not updated in 7 days"
  }
}
```

---

## 🗄️ Database Changes

### New Columns in `reports` Table

```sql
-- Numeric priority score (0-100)
ALTER TABLE reports 
ADD COLUMN priority_score INTEGER DEFAULT 50;

-- Timestamp of last priority update
ALTER TABLE reports 
ADD COLUMN priority_updated_at TIMESTAMP DEFAULT NOW();

-- Indexes for performance
CREATE INDEX idx_reports_priority_score 
ON reports(priority_score DESC) 
WHERE is_resolved = false;

CREATE INDEX idx_reports_priority_updated_at 
ON reports(priority_updated_at DESC);
```

### Migration

Run the SQL migration file:
```bash
psql -U your_user -d your_database -f migrations/add_priority_score.sql
```

---

## ⚙️ Setup & Configuration

### 1. Run Database Migration

```bash
cd Backend
psql -U postgres -d jan_setu -f migrations/add_priority_score.sql
```

### 2. Restart Backend Server

```bash
npm run dev
```

### 3. Optional: Set Up Cron Job

For periodic batch updates, add a cron job:

```bash
# Update priorities daily at 2 AM
0 2 * * * curl -X POST http://localhost:3000/api/v1/priority/recalculate-batch
```

Or use Node.js scheduling:
```javascript
import cron from 'node-cron';

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('🔄 Running scheduled priority recalculation...');
  // Call batch recalculation
});
```

---

## 📈 Best Practices

### 1. Initial Setup

After installing:
```bash
# Recalculate all existing reports
curl -X POST http://localhost:3000/api/v1/priority/recalculate-batch \
  -H "Content-Type: application/json" \
  -d '{"onlyUnresolved": false}'
```

### 2. Regular Maintenance

- **Daily**: Run batch recalculation for unresolved reports
- **Weekly**: Review priority statistics
- **Monthly**: Check reports needing updates

### 3. Performance Tips

- Use `onlyUnresolved: true` for faster batch updates
- Schedule batch updates during low-traffic hours
- Monitor priority update logs for failures

### 4. Testing Priority Changes

Use the preview endpoint to test without saving:
```bash
curl http://localhost:3000/api/v1/priority/calculate/123
```

---

## 🔍 Monitoring & Debugging

### View Priority Logs

Priority calculations log detailed breakdowns:

```
🎯 Calculating dynamic priority for report 123

📊 Priority Score Breakdown:
   Category (Public Safety): 25.0 pts
   Clustering: 14.0 pts
   Engagement: 18.5 pts
   Time Decay: 8.3 pts
   Media: 4.0 pts
   Admin Interaction: 2.0 pts
   ─────────────────────────────────
   TOTAL: 72 pts → HIGH
```

### Common Issues

**Issue:** Priority not updating
- **Check:** Social post exists for report
- **Fix:** Ensure report has social post created

**Issue:** All priorities showing same level
- **Check:** Database migration ran successfully
- **Fix:** Re-run migration script

**Issue:** Batch update taking too long
- **Limit:** Use smaller batches or `reportIds` array
- **Schedule:** Run during off-peak hours

---

## 🎓 Example Scenarios

### Scenario 1: Water Main Break

```
Initial State:
- Category: Water Supply (high severity) → 23 pts
- Location: 8 nearby reports → 16 pts
- Engagement: Just created → 0 pts
- Time: New → 0 pts
- Media: 3 photos → 3 pts
- Admin: Pending → 0 pts
Total: 42 pts → MEDIUM

After 6 hours:
- Community engagement: 25 upvotes, 12 comments → 17 pts
- Admin assigned → 5 pts
- Time still < 1 day → 0.7 pts
Total: 62 pts → HIGH

After 2 days (unresolved):
- Time decay increases → 1.4 pts
- More engagement → 20 pts
Total: 66 pts → HIGH → CRITICAL if nearby increases
```

### Scenario 2: Park Maintenance

```
Initial State:
- Category: Parks (low severity) → 10 pts
- Location: No nearby reports → 0 pts
- Engagement: None → 0 pts
- Time: New → 0 pts
- Media: 1 photo → 1 pt
- Admin: Pending → 0 pts
Total: 11 pts → LOW

After 30 days (unresolved):
- Time decay → 15 pts
- Some community interest → 8 pts
Total: 34 pts → MEDIUM
(Priority naturally increases if ignored)
```

---

## 🚀 Future Enhancements

Potential additions:
- Weather factor (rain increases drainage priority)
- Historical data analysis
- Machine learning predictions
- Citizen reputation weighting
- Geographic hotspot detection
- Real-time event correlation

---

## 📞 Support

For questions or issues:
- Check logs in console for detailed breakdowns
- Review priority stats endpoint for overview
- Test with preview endpoint before applying changes

---

**Version:** 1.0  
**Last Updated:** February 13, 2026  
**Compatibility:** JanSetu Backend v3.0+
