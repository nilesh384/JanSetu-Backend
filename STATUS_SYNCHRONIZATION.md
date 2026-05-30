# Status Synchronization Across Platforms

This document explains how report statuses are synchronized across all three platforms: User App, Admin Panel Website, and Field Admin App.

## Database Status Flow

The reports table maintains a single `status` field that serves as the single source of truth. Here's the lifecycle:

### 1. **Report Submission (User submits report)**
- **Database Status**: `pending`
- **User App Display**: "Pending"
- **Admin Panel Display**: "Pending"
- **Field Admin App**: Not visible (not assigned yet)

### 2. **Report Assignment (Admin assigns to field admin)**
- **Database Status**: `assigned`
- **User App Display**: "Assigned"
- **Admin Panel Display**: "Assigned" (shows actual status from database)
- **Field Admin App Display**: "Pending" (mapped from assigned → pending for field admin perspective)

### 3. **Work Started (Field admin starts working)**
- **Database Status**: `in_progress`
- **User App Display**: "In Progress"
- **Admin Panel Display**: "In Progress"
- **Field Admin App Display**: "In Progress"

### 4. **Work Completed (Field admin completes the task)**
- **Database Status**: `resolved`
- **User App Display**: "Completed"
- **Admin Panel Display**: "Completed" or "Resolved"
- **Field Admin App Display**: "Completed"

## Status Values

### Database Enum Values
```sql
status ENUM('pending', 'assigned', 'in_progress', 'resolved', 'rejected')
```

### Field Admin Display Mapping
The Field Admin App uses a special display mapping because newly "assigned" work should appear as "pending" work to the field admin:

| Database Status | Field Admin Display |
|----------------|---------------------|
| `pending`      | "Pending" (unassigned) |
| `assigned`     | "Pending" (assigned, needs to start) |
| `in_progress`  | "In Progress" |
| `resolved`     | "Completed" |
| `rejected`     | "Rejected" |

## API Response Structure

### Field Admin Endpoints
All field admin endpoints (`/api/field-admin/*`) return both the actual database status and a display status:

```json
{
  "status": "assigned",          // Actual database status
  "displayStatus": "pending"     // What to show in the field admin app
}
```

### Admin Panel & User App Endpoints
These endpoints return the actual database status directly and display it as-is:

```json
{
  "status": "assigned"           // Use this directly for display (shows as "Assigned")
}
```

**Note:** The Admin Panel now displays the actual database status values (`pending`, `assigned`, `in_progress`, `resolved`, `rejected`) while the Field Admin App uses a display mapping for better UX (e.g., `assigned` is shown as "Pending" to indicate new work).

## Backend Implementation

### Field Admin Controllers (`fieldAdmin.controllers.js`)

```javascript
const getFieldAdminDisplayStatus = (dbStatus) => {
    const statusMap = {
        'assigned': 'pending',        // Assigned reports show as pending
        'pending': 'pending',         // Unassigned pending stays pending
        'in_progress': 'in_progress', // In progress stays the same
        'resolved': 'completed',      // Resolved shows as completed
        'rejected': 'rejected'        // Rejected stays the same
    };
    return statusMap[dbStatus] || dbStatus;
};
```

### Status Update Endpoints

1. **Assign Report** (`POST /api/reports/:reportId/assign`)
   - Updates: `status = 'assigned'`
   - Triggers: Notification to field admin

2. **Start Work** (`POST /api/field-admin/reports/:reportId/start`)
   - Updates: `status = 'in_progress'`, `work_started_at = NOW()`
   - Creates: Work log entry

3. **Complete Report** (`POST /api/field-admin/reports/:reportId/complete`)
   - Updates: `status = 'resolved'`, `is_resolved = true`, `resolved_at = NOW()`
   - Creates: Work log entry with photos and notes

## Frontend Implementation

### User App Status Display (`reportDetails.tsx`, `my.tsx`, `nearby.tsx`)

```typescript
const getStatusColor = (status?: string) => {
  const statusColors: { [key: string]: string } = {
    pending: '#FF9800',       // Orange
    assigned: '#9C27B0',      // Purple  
    in_progress: '#2196F3',   // Blue
    resolved: '#4CAF50',      // Green
    rejected: '#F44336',      // Red
  };
  return statusColors[status?.toLowerCase() || 'pending'] || '#2196F3';
};

const getStatusText = (status?: string) => {
  const statusLabels: { [key: string]: string } = {
    pending: 'Pending',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    resolved: 'Completed',
    rejected: 'Rejected',
  };
  return statusLabels[status?.toLowerCase() || 'pending'] || 'Pending';
};
```

**User App displays actual database status with user-friendly labels:**
- `pending` → "Pending" 🟠
- `assigned` → "Assigned" 🟣  
- `in_progress` → "In Progress" 🔵
- `resolved` → "Completed" 🟢
- `rejected` → "Rejected" 🔴

## FAdmin Panel Website Status Display (`pages/Reports.jsx` & `pages/ReportDetails.jsx`)

```javascript
const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pending', color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
      assigned: { label: 'Assigned', color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
      in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
      resolved: { label: 'Completed', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
    };
    return statusConfig[status?.toLowerCase()] || statusConfig.pending;
};
```

**Admin Panel displays actual database status:**
- `pending` → "Pending"
- `assigned` → "Assigned"
- `in_progress` → "In Progress"
- `resolved` → "Completed"
- `rejected` → "Rejected"

### Field Admin App (`constants/index.ts`)

```typescript
// Status display mapping
export const FIELD_ADMIN_STATUS_MAP = {
  'assigned': { label: 'Pending', displayStatus: 'pending' },
  'pending': { label: 'Not Assigned', displayStatus: 'pending' },
  'in_progress': { label: 'In Progress', displayStatus: 'in_progress' },
  'resolved': { label: 'Completed', displayStatus: 'resolved' },
  'rejected': { label: 'Rejected', displayStatus: 'rejected' },
};
```

**Field Admin App uses mapped status for better UX:**
- `assignAdmin Panel → Shows "Assigned"
5. Check Field Admin App → Shows "Pending" (1 pending item)
6. Field admin starts work → Status: `in_progress`
7. Check all platforms → Admin Panel shows "In Progress", Field Admin shows "In Progress"
8. Field admin completes → Status: `resolved`
9. Check all platforms → Admin Panel shows "Completed", Field Admin shows': { label: 'Rejected', displayStatus: 'rejected' },
};
```

### Dashboard Statistics

The field admin dashboard counts both 'pending' and 'assigned' statuses as "pending work":

```sql
COUNT(*) FILTER (WHERE status IN ('pending', 'assigned')) as pending
```

## Synchronization Guarantees

✅ **Single Source of Truth**: The database `status` field is the only source of truth  
✅ **Automatic Sync**: All platforms query the same database, ensuring real-time sync  
✅ **Transaction Safety**: Status updates happen within database transactions  
✅ **Audit Trail**: All status changes are logged in `work_logs` table  

## Testing Status Flow

### Test Scenario 1: Complete Workflow
1. User submits report → Status: `pending`
2. Check Admin Panel → Shows "Pending"
3. Admin assigns to field a10, 2026  
**Version**: 1.1dmin App → Shows "Pending" (1 pending item)
5. Field admin starts work → Status: `in_progress`
6. Check all platforms → All show "In Progress"
7. Field admin completes → Status: `resolved`
8. Check all platforms → All show "Completed"

### Test Scenario 2: Status Counts
1. Admin assigns 5 reports → Field admin dashboard shows 5 pending
2. Field admin starts 2 reports → Dashboard shows 3 pending, 2 in progress
3. Field admin completes 1 report → Dashboard shows 3 pending, 1 in progress, 1 completed

## Important Notes

⚠️ **Never update status directly in frontend** - Always use the provided API endpoints  
⚠️ **Always check both `status` and `displayStatus`** in Field Admin App  
⚠️ **Use transactions** when updating status to maintain data consistency  
⚠️ **Log all status changes** in work_logs for audit trail  

## API Endpoints Summary

| Action | Endpoint | Status Change |
|--------|----------|---------------|
| Create Report | `POST /api/reports` | → `pending` |
| Assign Report | `POST /api/reports/:id/assign` | `pending` → `assigned` |
| Start Work | `POST /api/field-admin/reports/:id/start` | `assigned` → `in_progress` |
| Complete Work | `POST /api/field-admin/reports/:id/complete` | `in_progress` → `resolved` |

---

**Last Updated**: February 13, 2026  
**Version**: 1.2.0
