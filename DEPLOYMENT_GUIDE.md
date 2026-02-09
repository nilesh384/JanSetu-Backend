# Deployment Guide - Status Synchronization Fix

## What Was Fixed

The User App and Admin Panel were not receiving the `status` field when fetching reports, causing them to display incorrect or outdated status information.

### Changes Made

#### 1. **getUserReports** endpoint (`reports.controller.js`)
**Added the following fields to the response:**
- `status` - Current report status (pending, assigned, in_progress, resolved)
- `assignedAdminId` - ID of the assigned field admin (if any)
- `updatedAt` - Timestamp of last update

**Before:**
```javascript
const mappedReports = result.rows.map(report => ({
    id: report.id,
    userId: report.user_id,
    title: report.title,
    // ... other fields ...
    // ❌ Missing: status, assignedAdminId, updatedAt
}));
```

**After:**
```javascript
const mappedReports = result.rows.map(report => ({
    id: report.id,
    userId: report.user_id,
    title: report.title,
    status: report.status,                     // ✅ Now included
    assignedAdminId: report.assigned_admin_id, // ✅ Now included
    updatedAt: toISO(report.updated_at),       // ✅ Now included
    // ... other fields ...
}));
```

#### 2. **Field Admin App Changes**
- Added display status mapping (assigned → pending for field admin view)
- Updated dashboard statistics to count 'assigned' as pending work
- Added "Start Work" button for assigned reports
- All status labels now use helper functions for consistent display

## Deployment Steps

### Option 1: Deploy Updated Backend (Recommended)

1. **Test Locally First**
   ```bash
   cd Backend
   npm test  # If you have tests
   node server.js  # Start locally and verify
   ```

2. **Commit Changes**
   ```bash
   git add Backend/controllers/reports.controller.js
   git add Backend/controllers/fieldAdmin.controllers.js
   git commit -m "Fix: Add status field to getUserReports endpoint for User App synchronization"
   ```

3. **Deploy to Production**
   - If using a service like Heroku, Vercel, or Railway:
     ```bash
     git push production main
     ```
   - If using SSH deployment:
     ```bash
     ssh your-server
     cd /path/to/backend
     git pull origin main
     pm2 restart all  # or your process manager
     ```

4. **Verify Deployment**
   - Test the endpoint: `GET /api/reports/user/:userId`
   - Confirm response includes `status`, `assignedAdminId`, and `updatedAt`

5. **Clear Redis Cache** (if using caching)
   ```bash
   # Connect to Redis
   redis-cli
   # Clear user reports cache
   FLUSHDB  # or selectively delete keys
   ```

### Option 2: Update Frontend Apps (If Backend Can't Be Updated Immediately)

If you cannot update the deployed backend right away, you can update the User App and Admin Panel frontends to handle missing status fields gracefully:

**User App (Example):**
```javascript
// In your report display component
const getDisplayStatus = (report) => {
  // If status field doesn't exist, infer from other fields
  if (!report.status) {
    if (report.isResolved) return 'resolved';
    if (report.assignedAdminId) return 'assigned';
    return 'pending';
  }
  return report.status;
};
```

**Admin Panel (Example):**
```javascript
// In your report list component
const status = report.status || (report.isResolved ? 'resolved' : 'pending');
```

## Status Field Reference

### Database Values
```sql
status ENUM('pending', 'assigned', 'in_progress', 'resolved', 'rejected')
```

### Display Labels by Platform

| DB Status | User App | Admin Panel | Field Admin App |
|-----------|----------|-------------|-----------------|
| `pending` | "Submitted" or "Pending" | "Pending" | Not visible (unassigned) |
| `assigned` | "Assigned" | "Assigned" | "Pending" |
| `in_progress` | "In Progress" | "In Progress" | "In Progress" |
| `resolved` | "Completed" | "Completed/Resolved" | "Completed" |
| `rejected` | "Rejected" | "Rejected" | "Rejected" |

## Testing Checklist

After deployment, verify the following:

### User App
- [ ] User can see status of their submitted reports
- [ ] Status changes from "Pending" to "Assigned" when admin assigns
- [ ] Status changes to "In Progress" when field admin starts work
- [ ] Status changes to "Completed" when field admin completes work
- [ ] User can see who the report is assigned to (if applicable)

### Admin Panel
- [ ] All reports show correct status
- [ ] Can filter reports by status (including 'assigned')
- [ ] Status updates in real-time when field admin makes changes
- [ ] Assigned admin information is visible

### Field Admin App
- [ ] Newly assigned reports appear in "Pending" list
- [ ] Red notification badge shows count of pending items
- [ ] "Start Work" button appears for assigned reports
- [ ] Status changes to "In Progress" when work starts
- [ ] Completed reports show in completed section

## Troubleshooting

### Issue: User App still shows old status

**Solution:**
1. Clear app cache/data
2. Force close and reopen the app
3. Pull to refresh the reports list
4. Check backend logs to verify status is being returned:
   ```bash
   # Check backend logs
   tail -f /path/to/logs/app.log
   # Look for: "Found X reports for user"
   ```

### Issue: Admin Panel shows "undefined" for status

**Solution:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Verify API response in Network tab:
   - Open DevTools → Network
   - Filter for the reports API call
   - Check response includes `status` field

### Issue: Inconsistent status across platforms

**Solution:**
1. Verify all apps are connected to the same database
2. Check that cache is cleared (Redis/App cache)
3. Confirm backend deployment completed successfully
4. Check database directly:
   ```sql
   SELECT id, title, status, assigned_admin_id, updated_at 
   FROM reports 
   WHERE id = 'your-report-id';
   ```

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**
   ```bash
   git revert HEAD
   git push production main
   pm2 restart all
   ```

2. **Restore Previous Backend**
   ```bash
   git checkout <previous-commit-hash>
   git push production main --force
   ```

3. **Clear Redis Cache**
   ```bash
   redis-cli FLUSHDB
   ```

4. **Notify Users**
   - Post maintenance message
   - Ask users to refresh their apps

## Support

If you encounter issues:
1. Check backend logs for errors
2. Verify database connection
3. Test API endpoints with Postman/curl
4. Review Redis cache status

## Related Documentation

- [STATUS_SYNCHRONIZATION.md](./STATUS_SYNCHRONIZATION.md) - Complete status flow documentation
- Database schema for reports table
- API endpoint documentation

---

**Last Updated:** February 9, 2026  
**Version:** 1.1.0  
**Author:** Generated for Jan Setu Admin Field App
