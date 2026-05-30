# Backend Implementation Guide - Fraud Detection System

## Overview

This guide covers the backend implementation for the fraud detection system, including database setup, API endpoints, and audit logging.

## 🗄️ Database Setup

### 1. Run the Migration

The audit log table is required for tracking report deletions. Run the migration:

#### Option A: Using PostgreSQL CLI
```bash
cd Backend/db/migrations
psql -U your_username -d your_database -f 001_create_audit_log_table.sql
```

#### Option B: Using Node.js Script
```bash
cd Backend
node db/migrations/run_migration.js
```

#### Option C: Manual SQL Execution
Connect to your PostgreSQL database and execute the contents of:
`Backend/db/migrations/001_create_audit_log_table.sql`

### 2. Verify Installation

Check that the table was created:
```sql
SELECT * FROM report_deletion_audit LIMIT 1;
```

## 📡 API Endpoint

### DELETE /api/v1/reports/:reportId

Deletes a report with proper authorization and audit logging.

#### Request Format

**URL Parameter:**
- `reportId` (UUID) - The ID of the report to delete

**Body Parameters:**

For **Admin Deletion** (fraud/spam):
```json
{
  "adminId": "admin-uuid-here",
  "reason": "Confirmed fraud: High dislike ratio and bot-generated engagement detected",
  "fraudIndicators": {
    "isFraud": true,
    "score": 85,
    "severity": "critical",
    "reasons": [
      "High dislike ratio: 92% of votes are negative",
      "No organic discussion: High votes but zero comments",
      "Suspicious view pattern: 150 views per like"
    ]
  }
}
```

For **User Deletion** (self-deletion):
```json
{
  "userId": "user-uuid-here"
}
```

#### Response Format

**Success (200):**
```json
{
  "success": true,
  "message": "Report deleted successfully",
  "deletedReportId": "report-uuid",
  "deletedBy": "admin"
}
```

**Error Responses:**

- **400 Bad Request** - Missing required fields
- **403 Forbidden** - Authorization failure
- **404 Not Found** - Report doesn't exist
- **500 Server Error** - Database or server error

## 🔐 Authorization

### Admin Deletion
- Requires `adminId` in request body
- Admin must exist and be active in `admins` table
- No ownership check - admins can delete any report
- Requires deletion `reason` (mandatory)
- Creates audit log entry

### User Deletion
- Requires `userId` in request body
- User must own the report (user_id matches)
- No audit log created (normal user action)

## 📊 Audit Trail

Every admin deletion creates an audit log entry with:

### Stored Information:
- **Report Details**: ID, title, category, user
- **Admin Details**: ID, email
- **Deletion Context**: Reason, timestamp
- **Fraud Analysis**: Score, severity, reasons (if provided)
- **Full Snapshot**: Complete report JSON for reference

### Query Audit Logs:

```sql
-- Recent deletions
SELECT 
    report_title,
    deleted_by_admin_email,
    deletion_reason,
    deleted_at
FROM report_deletion_audit
ORDER BY deleted_at DESC
LIMIT 20;

-- Fraud deletions only
SELECT *
FROM report_deletion_audit
WHERE fraud_indicators IS NOT NULL
  AND (fraud_indicators->>'isFraud')::boolean = true
ORDER BY deleted_at DESC;

-- Deletions by specific admin
SELECT *
FROM report_deletion_audit
WHERE deleted_by_admin_email = 'admin@example.com'
ORDER BY deleted_at DESC;

-- High-score fraud cases
SELECT 
    report_title,
    deleted_by_admin_email,
    fraud_indicators->>'score' as fraud_score,
    fraud_indicators->>'severity' as severity,
    deletion_reason,
    deleted_at
FROM report_deletion_audit
WHERE fraud_indicators IS NOT NULL
  AND CAST(fraud_indicators->>'score' AS INTEGER) >= 70
ORDER BY deleted_at DESC;
```

## 🔄 Cleanup Actions

When a report is deleted, the following related data is automatically cleaned up:

1. **Social Posts** - Removes associated social media post
2. **Comments** - Deletes all comments on the social post
3. **Votes** - Removes all upvotes/downvotes
4. **User Stats** - Decrements user's report count
5. **Redis Cache** - Invalidates relevant caches

## 🧪 Testing

### Test Admin Deletion

```bash
curl -X DELETE http://localhost:4000/api/v1/reports/{REPORT_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "adminId": "your-admin-uuid",
    "reason": "Test fraud deletion",
    "fraudIndicators": {
      "isFraud": true,
      "score": 75,
      "severity": "high",
      "reasons": ["Test reason 1", "Test reason 2"]
    }
  }'
```

### Test User Deletion

```bash
curl -X DELETE http://localhost:4000/api/v1/reports/{REPORT_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "report-owner-uuid"
  }'
```

## 📝 Frontend Integration

The frontend already includes the proper API call. In `Admin_Panel/Frontend/src/api/user.js`:

```javascript
export const deleteReport = async (reportId, adminId, reason = '') => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/reports/${reportId}`, {
            data: {
                adminId,
                reason
            }
        });

        return {
            success: true,
            message: response.data.message || "Report deleted successfully"
        };
    } catch (error) {
        return {
            success: false,
            message: error.response?.data?.message || "Failed to delete report"
        };
    }
};
```

## 🔍 Monitoring & Analytics

### Key Metrics to Track:

1. **Deletion Rate**: Number of deletions per day/week
2. **Fraud Score Distribution**: Average fraud scores of deleted reports
3. **Admin Activity**: Which admins are deleting reports
4. **Category Analysis**: Which categories have most fraud
5. **Time Patterns**: When fraud reports are typically created/deleted

### Sample Analytics Query:

```sql
-- Fraud statistics by category
SELECT 
    report_category,
    COUNT(*) as deletion_count,
    AVG(CAST(fraud_indicators->>'score' AS INTEGER)) as avg_fraud_score,
    COUNT(CASE WHEN fraud_indicators->>'severity' = 'critical' THEN 1 END) as critical_count
FROM report_deletion_audit
WHERE fraud_indicators IS NOT NULL
  AND deleted_at >= NOW() - INTERVAL '30 days'
GROUP BY report_category
ORDER BY deletion_count DESC;
```

## 🛡️ Security Considerations

1. **Admin Verification**: Always verify admin is active before deletion
2. **Audit Logging**: Never skip audit logs for admin deletions
3. **Reason Required**: Force admins to document why they're deleting
4. **Data Retention**: Consider keeping audit logs indefinitely
5. **Access Control**: Ensure only authorized admins can access deletion endpoint

## 🚨 Error Handling

The endpoint handles these error cases:

1. **Missing Parameters**: Returns 400 with clear error message
2. **Invalid Admin**: Returns 403 if admin doesn't exist or inactive
3. **Unauthorized User**: Returns 403 if user tries to delete others' reports
4. **Report Not Found**: Returns 404 with appropriate message
5. **Database Errors**: Returns 500 with error details
6. **Audit Log Failures**: Logs warning but continues (graceful degradation)

## 📦 Dependencies

No additional npm packages required. Uses existing:
- `pg` (PostgreSQL client)
- Database transaction utilities
- Redis for cache invalidation

## 🔄 Rollback

If you need to remove the audit log table:

```sql
DROP TABLE IF EXISTS report_deletion_audit;
```

**Warning**: This will permanently delete all audit history!

## 📞 Support

For issues or questions:

1. Check server logs for detailed error messages
2. Verify database connection and migrations
3. Ensure admin exists in `admins` table
4. Check Redis connection for cache invalidation
5. Review PostgreSQL logs for database errors

## 🎯 Next Steps

1. Run the database migration
2. Test the endpoint with curl or Postman
3. Verify audit logs are being created
4. Test frontend integration
5. Set up monitoring for fraud patterns
6. Create admin dashboards for audit review

---

**Implementation Status**: ✅ Complete and Ready for Production
