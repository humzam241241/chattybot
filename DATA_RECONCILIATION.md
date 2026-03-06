# Data Reconciliation System

## Overview

The data reconciliation system automatically scans the database to recover missed lead information that may have slipped through initial extraction. It runs daily at 2 AM and can also be triggered manually from the admin dashboard.

## What It Does

The reconciliation worker performs three recovery operations:

### 1. Re-scan Missed Leads
- Checks conversations in the `missed_leads` table that haven't been recovered
- Re-analyzes messages to see if contact info appeared later in the conversation
- Uses both regex (relaxed phone pattern) and OpenAI extraction
- If contact info is found, creates a proper lead record and marks as recovered

### 2. Re-scan Unleaded Conversations
- Finds conversations with 4+ messages that don't have a lead record
- Performs comprehensive extraction on these conversations
- Creates new lead records if any contact info is found
- Helps catch leads that were missed by the initial extraction pipeline

### 3. Re-extract Partial Leads
- Identifies leads with missing fields (no email, phone, or name)
- Re-runs extraction on those conversations
- Fills in any missing fields found in the conversation
- Uses `COALESCE` to preserve existing data

## Implementation

### Files Created

1. **`backend/workers/dataReconciliationWorker.js`**
   - Main reconciliation logic
   - Three-step recovery pipeline
   - Relaxed phone regex for better detection: `/\b\d{10}\b/g`
   - Stats tracking: `missedLeadsRecovered`, `newLeadsFound`, `partialLeadsUpdated`, `errors`

2. **`backend/src/routes/adminReconcile.js`**
   - Admin API endpoint: `POST /api/admin/reconcile`
   - Spawns worker as child process
   - Returns immediately (runs in background)
   - Status endpoint placeholder for future job tracking

3. **`backend/migrations/008_data_reconciliation.sql`**
   - Adds `recovered_at` column to `missed_leads` table
   - Creates index for efficient queries on unrecovered leads

4. **`admin/src/app/api/reconcile/route.js`**
   - Next.js API route proxy
   - Calls backend endpoint with admin auth

5. **`admin/src/lib/api.js`**
   - Client function: `triggerReconciliation()`

6. **`admin/src/app/page.js`**
   - Dashboard UI button: "🔄 Scan for Missed Data"
   - Confirmation dialog
   - Loading state

### Scheduler Integration

Added to `backend/workers/index.js`:
```javascript
dataReconciliationWorker: {
  path: path.join(WORKERS_DIR, 'dataReconciliationWorker.js'),
  schedule: '0 2 * * *',
  description: 'daily at 2 AM',
}
```

## How to Use

### Automatic (Scheduled)
- Runs daily at 2 AM
- No action required
- Check backend logs for results

### Manual Trigger
1. Open admin dashboard (home page)
2. Click "🔄 Scan for Missed Data" button
3. Confirm the dialog
4. Worker starts in background
5. Check backend logs for detailed results

### Backend Logs
```
[DataReconciliation] === Starting data reconciliation ===
[DataReconciliation] [Step 1] Re-scanning missed_leads for recovered contact info...
[DataReconciliation] Re-scanning 15 missed leads
[DataReconciliation] ✓ Recovered lead from missed_lead: abc123 (WARM)
[DataReconciliation] [Step 1] Recovered 3 missed leads
[DataReconciliation] [Step 2] Re-scanning conversations without leads...
[DataReconciliation] ✓ Extracted new lead: xyz789 (HOT)
[DataReconciliation] [Step 2] Found 5 new leads
[DataReconciliation] [Step 3] Re-scanning partial leads...
[DataReconciliation] ✓ Updated partial lead: def456
[DataReconciliation] [Step 3] Updated 2 partial leads
[DataReconciliation] === Reconciliation complete ===
[DataReconciliation] Results: {
  "missedLeadsRecovered": 3,
  "newLeadsFound": 5,
  "partialLeadsUpdated": 2,
  "errors": 0
}
```

## Benefits

1. **Recovers Lost Revenue**: Finds leads that were missed by initial extraction
2. **Fills Data Gaps**: Completes partial lead records
3. **Improves Data Quality**: Ensures database accuracy
4. **Non-Intrusive**: Runs at 2 AM when traffic is low
5. **Safe**: Only updates/creates records, never deletes
6. **Idempotent**: Can be run multiple times safely
7. **Transparent**: Detailed logging for audit trail

## Recovery Strategies

### Regex Enhancements
- Standard email: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g`
- Standard phone: `/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g`
- **NEW** Relaxed phone: `/\b\d{10}\b/g` (catches "5551234567")

### OpenAI Fallback
- If regex finds nothing, still runs OpenAI extraction
- If OpenAI returns null, uses regex results
- Merges both sources for best coverage

### Deduplication
- Uses `ON CONFLICT (conversation_id) DO UPDATE`
- Won't create duplicate leads
- Updates existing records with new data

## Performance

- Processes up to 50 missed leads per run
- Processes up to 100 unleaded conversations per run
- Processes up to 50 partial leads per run
- Limits prevent excessive OpenAI API usage
- Adjust limits in worker code if needed

## Future Enhancements

1. **Job Tracking**: Store reconciliation results in database
2. **Status Dashboard**: Real-time progress in admin UI
3. **Email Reports**: Send reconciliation summary to admin
4. **Selective Reconciliation**: Run on specific site or date range
5. **Webhook Integration**: Notify external systems of recovered leads
6. **Machine Learning**: Learn from recovery patterns to improve initial extraction

## Testing

### Local Testing
```bash
# Run worker manually
node backend/workers/dataReconciliationWorker.js

# Check logs for results
# Worker exits when complete
```

### API Testing
```bash
curl -X POST http://localhost:3001/api/admin/reconcile \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

## Deployment

1. Push migration 008 to Supabase
2. Deploy backend with new worker
3. Deploy admin with new UI button
4. Worker scheduler automatically picks up new worker
5. First run: 2 AM next day (or trigger manually)

## Migration

Run in Supabase SQL editor:
```sql
-- backend/migrations/008_data_reconciliation.sql
ALTER TABLE missed_leads ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_missed_leads_recovered ON missed_leads(recovered_at) WHERE recovered_at IS NULL;
COMMENT ON COLUMN missed_leads.recovered_at IS 'Timestamp when lead was recovered via reconciliation';
```
