# Backend Voucher System - Deployment Guide

## Changes Made

### 1. New Vouchers Sheet
Added a new sheet to store voucher records with the following columns:
- `id` - Unique voucher identifier
- `userId` - User who owns the voucher
- `checkpointStampCount` - Stamp count when voucher was earned
- `rewardName` - Name of the reward
- `createdAt` - ISO timestamp when voucher was created
- `expiresAt` - ISO timestamp when voucher expires (30 days from creation)
- `redeemedAt` - ISO timestamp when voucher was redeemed (empty if not redeemed)
- `status` - Current status: `active`, `redeemed`, or `expired`

### 2. Updated Transaction Types
Added two new transaction types:
- `voucher_earned` - Logged when user receives a voucher
- `voucher_redeemed` - Logged when user redeems a voucher

### 3. New API Endpoints

#### `getUserVouchers`
**Parameters**: `userId`
**Returns**: List of all vouchers for the user
**Features**:
- Auto-updates expired vouchers on fetch
- Returns voucher details including status

#### `redeemVoucher`
**Parameters**: `voucherId`, `userId`
**Returns**: Updated voucher object
**Validations**:
- Checks voucher ownership
- Prevents redeeming already-redeemed vouchers
- Prevents redeeming expired vouchers
- Logs redemption transaction

### 4. Updated `addStamp` Endpoint
**New Behavior**:
- After adding stamp, checks if new stamp count is a checkpoint
- If checkpoint reached, automatically generates voucher
- Returns voucher object in response: `{ success: true, user: {...}, voucher: {...} }`
- Voucher is `null` if no checkpoint reached

### 5. Helper Functions Added

#### `generateVoucher(doc, userId, stampCount, rewardName)`
Creates a new voucher with:
- Unique ID
- 30-day expiry from creation
- Active status
- Transaction log entry

#### `checkIfCheckpoint(stampCount, checkpointConfig)`
Checks if a stamp count matches any checkpoint in configuration

#### `calculateExpiryDate(fromDate, days)`
Calculates expiry date (default 30 days)

#### `getCheckpointConfiguration(doc)`
Fetches checkpoint configuration from CheckpointConfig sheet

## Deployment Steps

### Step 1: Run Setup Function
1. Open Google Apps Script editor
2. Run the `setup()` function manually
3. Authorize the script when prompted
4. Verify "Vouchers" sheet is created in spreadsheet

### Step 2: Redeploy Web App
1. Click "Deploy" → "Manage deployments"
2. Click "Edit" (pencil icon) on existing deployment
3. Update version to "New version"
4. Add description: "V13 - Added Voucher System"
5. Click "Deploy"
6. Copy the new Web App URL (should be the same)

### Step 3: Verify Deployment
Test the new endpoints:

**Test getUserVouchers**:
```
GET https://script.google.com/.../exec?action=getUserVouchers&userId=user-123
```

**Test addStamp (should generate voucher at checkpoint)**:
```
POST https://script.google.com/.../exec?action=addStamp
Body: { "userId": "user-123" }
```

**Test redeemVoucher**:
```
POST https://script.google.com/.../exec?action=redeemVoucher
Body: { "voucherId": "voucher-...", "userId": "user-123" }
```

## Database Schema

### Vouchers Sheet Example
```
| id                    | userId    | checkpointStampCount | rewardName           | createdAt           | expiresAt           | redeemedAt          | status   |
|-----------------------|-----------|----------------------|----------------------|---------------------|---------------------|---------------------|----------|
| voucher-1707484800123 | user-001  | 3                    | Free Lychee Tea      | 2026-02-09T14:00:00 | 2026-03-11T14:00:00 |                     | active   |
| voucher-1707488400456 | user-001  | 5                    | diskon 15% off game  | 2026-02-09T15:00:00 | 2026-03-11T15:00:00 | 2026-02-10T10:00:00 | redeemed |
```

### Transactions Sheet Updates
New transaction types will appear:
```
| id           | userId    | type             | amount | timestamp     | dateString          |
|--------------|-----------|------------------|--------|---------------|---------------------|
| tx-170748... | user-001  | voucher_earned   | 1      | 1707484800000 | 2026-02-09T14:00:00 |
| tx-170748... | user-001  | voucher_redeemed | 1      | 1707488400000 | 2026-02-09T15:00:00 |
```

## Troubleshooting

### Issue: Vouchers sheet not created
**Solution**: Run `setup()` function manually in Apps Script editor

### Issue: Voucher not generated on checkpoint
**Solution**: 
- Check CheckpointConfig sheet has correct data
- Verify stamp count matches checkpoint exactly
- Check Apps Script logs for errors

### Issue: Cannot redeem voucher
**Solution**:
- Verify voucher is `active` status
- Check expiry date hasn't passed
- Ensure userId matches voucher owner

## Notes

- Vouchers expire 30 days after creation
- Expired vouchers cannot be redeemed
- Each checkpoint can only generate one voucher per user
- Voucher IDs are unique and include timestamp + random string
