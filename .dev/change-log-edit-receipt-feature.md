# Edit Receipt Feature - Implementation Plan

## Overview
Add ability to edit existing receipts directly from the summary panel.

---

## Column Structure (CRITICAL - Verified & Corrected)

### Current Google Sheet Columns (1-11) - CORRECTED
| Index | Column Name | Notes |
|-------|-------------|-------|
| 1 | Record_no | Auto-increment |
| 2 | Date | Receipt date |
| 3 | Created_at | ISO timestamp on first save |
| 4 | Modified_at | Updated on edits |
| 5 | Description | Vendor/merchant name |
| 6 | Amount | Numeric |
| 7 | Currency | HKD, USD, etc. |
| 8 | Category | Food, Transport, etc. |
| 9 | Remarks | Notes |
| 10 | Image_name | Timestamped filename (e.g., 20250528_143022_receipt.jpg) |
| 11 | Image_URL | Google Drive URL to image |

### New Column
| Index | Column Name | Notes |
|-------|-------------|-------|
| 12 | ID | UUID v4 (NEW - appended to rightmost) |

**Why column 12 (rightmost)?**
- Columns 10-11 already exist with Image_name and Image_URL
- Adding to the end (column 12) doesn't shift existing column indices
- No existing code references column 12
- Safest approach to avoid breaking current functions

---

## Field Name Alignment

### Problem
Frontend uses different field names than Google Sheet columns, causing confusion.

### Solution: Unified Naming

**Aligned Field Names (use everywhere):**

| Unified Name | Old Frontend Name | Sheet Column |
|--------------|-------------------|--------------|
| `id` | (NEW) | 12 - ID |
| `recordNo` | (NEW) | 1 - Record_no |
| `date` | `date` | 2 - Date |
| `createdAt` | (NEW) | 3 - Created_at |
| `modifiedAt` | (NEW) | 4 - Modified_at |
| `description` | `vendor` | 5 - Description |
| `amount` | `amount` | 6 - Amount |
| `currency` | `currency` | 7 - Currency |
| `category` | `category` | 8 - Category |
| `remarks` | `remarks` | 9 - Remarks |
| `imageName` | (NEW) | 10 - Image_name |
| `imageUrl` | (NEW) | 11 - Image_URL |
| `photoId` | `photoId` | (internal, not in sheet) |
| `imageDataUrl` | `imageDataUrl` | (internal, not in sheet) |

**Key Changes:**
- `vendor` → `description` (aligns with sheet)
- Add `id`, `recordNo`, `createdAt`, `modifiedAt`, `imageUrl`

---

## Step 0: Pre-Migration - Backfill UUIDs (CURRENT STEP) ✓ UPDATED

### Goal
Assign UUIDs to all existing receipts that don't have one.

### Why Step 0?
- Done BEFORE modifying production code
- No risk of breaking existing functionality
- All records will have IDs ready for edit feature

### Manual Method (Chosen)
Since you've corrected the headers manually, paste UUIDs directly into column 12:

**Steps:**
1. Add "ID" header to cell L1 (column 12)
2. Paste one UUID per row in column L (starting L2)

**20 UUIDs for manual pasting:**
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890
b2c3d4e5-f6a7-8901-bcde-f12345678901
c3d4e5f6-a7b8-9012-cdef-123456789012
d4e5f6a7-b8c9-0123-defa-234567890123
e5f6a7b8-c9d0-1234-efab-345678901234
f6a7b8c9-d0e1-2345-fabc-456789012345
a7b8c9d0-e1f2-3456-abcd-567890123456
b8c9d0e1-f2a3-4567-bcde-678901234567
c9d0e1f2-a3b4-5678-cdef-789012345678
d0e1f2a3-b4c5-6789-defa-890123456789
e1f2a3b4-c5d6-7890-efab-901234567890
f2a3b4c5-d6e7-8901-fabc-012345678901
a3b4c5d6-e7f8-9012-abcd-123456789012
b4c5d6e7-f8a9-0123-bcde-234567890123
c5d6e7f8-a9b0-1234-cdef-345678901234
d6e7f8a9-b0c1-2345-defa-456789012345
e7f8a9b0-c1d2-3456-efab-567890123456
f8a9b0c1-d2e3-4567-fabc-678901234567
a9b0c1d2-e3f4-5678-abcd-789012345678
b0c1d2e3-f4a5-6789-bcde-890123456789
```

Need more? Use a UUID generator or ask for additional UUIDs.

### Alternative: Apps Script Method
If you have many records, use this standalone function in Code.gs:

```javascript
function backfillMissingIds() {
  const folder = getOrCreateRootFolderCached();
  const sheet = getOrCreateSheet(folder);
  const values = sheet.getDataRange().getValues();
  
  // Check if header row has "ID" in column 12
  if (values[0][11] !== 'ID') {
    sheet.getRange(1, 12).setValue('ID');
    Logger.log('Added ID header to column 12');
  }
  
  let updatedCount = 0;
  
  // Start from row 2 (index 1) - skip header
  for (let i = 1; i < values.length; i++) {
    if (!values[i][11]) { // Column 12 (index 11) is empty
      const uuid = Utilities.getUuid();
      sheet.getRange(i + 1, 12).setValue(uuid);
      updatedCount++;
      Logger.log('Row ' + (i + 1) + ': Assigned ID ' + uuid);
    }
  }
  
  Logger.log('Migration complete. Updated ' + updatedCount + ' rows.');
}
```

### Verification
- [ ] Column 12 header shows "ID"
- [ ] All existing rows have UUID in column 12
- [ ] No empty cells in column 12 (data rows only)

---

## Step 1: Add ID Column & Align Fields

### Apps Script Changes (Code.gs)

1. **Update `getOrCreateSheet()`**
   - Ensure header row has "ID" in column 11
   - Add if missing (handles new sheets)

2. **Update `handleSaveReceipts()`**
   - Generate UUID: `Utilities.getUuid()`
   - Append to row array as column 11
   - Return `id` in response JSON

3. **Update `handleQueryReceipts()`**
   - Read column 11 (index 10, 0-based)
   - Include `id` in returned record objects
   - Map all fields using unified naming

4. **NEW: `handleUpdateReceipt()`** (prepare function signature)
   - Find row where column 11 == `id`
   - Update columns 2-9
   - Update column 4 (Modified_at) with current timestamp
   - Leave column 3 (Created_at) unchanged

5. **NEW: `handleDeleteReceipt()`** (prepare function signature)
   - Find row where column 11 == `id`
   - Delete entire row

### Frontend Changes (index.html)

1. **Refactor `receipts` array structure**
   - Rename `vendor` → `description`
   - Add `id` field (populated after save)
   - Add `createdAt`, `modifiedAt` fields

2. **Update `saveReceipts()`**
   - Receive `id` from Apps Script response
   - Store in `receipts` array

3. **Update `queryReceipts()`**
   - Receive `id` from API
   - Store in `summaryData` array

4. **Update `renderReviewTable()` / Card Rendering**
   - Change `r.vendor` → `r.description`
   - Update all `onchange` handlers
   - Update `updateReceipt()` function

5. **Update `addManualReceipt()`**
   - Use `description` instead of `vendor`

### Testing Step 1
- [ ] Save new receipt → ID appears in column 11
- [ ] Query receipts → ID returned in response
- [ ] Frontend receives and stores ID correctly
- [ ] Field renaming works (description vs vendor)

---

## Step 2: Edit Panel UI

### New HTML Section: `section-edit`
Reuse receipt card layout from review panel:

```html
<div class="section" id="section-edit">
  <div class="card">
    <div class="card-title">Edit Receipt</div>
    <div class="card-desc">Update receipt details.</div>
    
    <!-- Single receipt card (no loop) -->
    <div class="receipt-card" id="editReceiptCard">
      <!-- Same structure as review cards -->
    </div>
    
    <div class="button-row">
      <button class="btn btn-outline btn-compact" id="backFromEditBtn">
        <i class="fas fa-arrow-left"></i>
        <span>Back</span>
      </button>
      <button class="btn btn-primary btn-compact btn-two-line btn-icon-text" id="saveEditBtn">
        <i class="fas fa-save"></i>
        <span>Save<br>Edit</span>
      </button>
    </div>
  </div>
</div>
```

### Summary Panel Changes
- Add edit icon button to each summary table row
- `onclick="openEditPanel('${record.id}')"`
- Position: left of description column

### JavaScript Functions
- `openEditPanel(id)` - Find record by ID, populate edit form, show section
- `saveEditChanges()` - Call update API, handle response, return to summary
- `backFromEdit()` - Return to summary without saving

### Testing Step 2
- [ ] Edit icon appears in summary table
- [ ] Click opens edit panel with correct data
- [ ] Back button returns to summary
- [ ] Fields are editable

---

## Step 3: Update API Implementation

### Apps Script: Complete `handleUpdateReceipt()`

```javascript
function handleUpdateReceipt(data) {
  const folder = getOrCreateRootFolderCached();
  const sheet = getOrCreateSheet(folder);
  const values = sheet.getDataRange().getValues();
  
  // Find row by ID (column 11, index 10)
  const rowIndex = values.findIndex(row => row[10] === data.id);
  if (rowIndex === -1) throw new Error('Receipt not found');
  
  // Update columns 2-9 (indices 1-8)
  // 2:Date, 5:Description, 6:Amount, 7:Currency, 8:Category, 9:Remarks
  sheet.getRange(rowIndex + 1, 2).setValue(data.date);        // Column 2
  sheet.getRange(rowIndex + 1, 5).setValue(data.description); // Column 5
  sheet.getRange(rowIndex + 1, 6).setValue(data.amount);       // Column 6
  sheet.getRange(rowIndex + 1, 7).setValue(data.currency);     // Column 7
  sheet.getRange(rowIndex + 1, 8).setValue(data.category);     // Column 8
  sheet.getRange(rowIndex + 1, 9).setValue(data.remarks);      // Column 9
  
  // Update Modified_at (column 4, index 3)
  sheet.getRange(rowIndex + 1, 4).setValue(new Date().toISOString());
  
  return { success: true };
}
```

### Apps Script: Complete `handleDeleteReceipt()`

```javascript
function handleDeleteReceipt(data) {
  const folder = getOrCreateRootFolderCached();
  const sheet = getOrCreateSheet(folder);
  const values = sheet.getDataRange().getValues();
  
  // Find row by ID
  const rowIndex = values.findIndex(row => row[10] === data.id);
  if (rowIndex === -1) throw new Error('Receipt not found');
  
  // Delete row
  sheet.deleteRow(rowIndex + 1);
  
  return { success: true };
}
```

### Frontend: API Call Functions

```javascript
async function updateReceiptApi(receiptData) {
  // POST to Apps Script with action: 'updateReceipt'
}

async function deleteReceiptApi(id) {
  // POST to Apps Script with action: 'deleteReceipt'
}
```

### Testing Step 3
- [ ] Save Edit updates Google Sheet
- [ ] Modified_at timestamp updates
- [ ] Created_at remains unchanged
- [ ] Query returns updated data

---

## Step 4: Delete in Edit Panel

Reuse existing `deleteReceiptWithConfirm()` pattern:

1. Add delete button to edit panel (same row as remarks textarea)
2. Native `confirm("Delete this receipt?")` dialog
3. Call `deleteReceiptApi(id)`
4. On success: return to summary panel, refresh query
5. On error: show error toast

### Testing Step 4
- [ ] Delete confirmation dialog appears
- [ ] Confirm deletes receipt from sheet
- [ ] Cancel leaves receipt intact
- [ ] Returns to summary after delete

---

## Existing Data Migration (Option A) - NOW STEP 0

**This is now Step 0** - See "Step 0: Pre-Migration - Backfill UUIDs" section above.

Run the standalone `backfillMissingIds()` function BEFORE making any other code changes.

---

## Data Flow Summary

```
CAPTURE FLOW:
┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│ Capture     │───→│ Review Panel │───→│ Save to Sheet │
│ (new)       │    │ (edit fields)│    │ (generate ID) │
└─────────────┘    └──────────────┘    └───────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ Return ID to │
                                       │ frontend     │
                                       └──────────────┘

QUERY/EDIT FLOW:
┌──────────────┐    ┌─────────────┐    ┌───────────────┐
│ Summary Panel│───→│ Edit Panel  │───→│ Update Sheet  │
│ (click edit) │    │ (edit form) │    │ (find by ID)  │
└──────────────┘    └─────────────┘    └───────────────┘
       ▲                                      │
       └──────────────────────────────────────┘
              (return to summary)
```

---

## Critical Implementation Notes

### 1. Column Index References (0-based arrays)
```javascript
// In Apps Script when using getValues():
row[0]  // Record_no
row[1]  // Date
row[2]  // Created_at
row[3]  // Modified_at
row[4]  // Description
row[5]  // Amount
row[6]  // Currency
row[7]  // Category
row[8]  // Remarks
row[9]  // Image_URL
row[10] // ID (NEW)
```

### 2. Sheet Range References (1-based)
```javascript
// getRange(row, column) - both 1-based
sheet.getRange(rowIndex + 1, 11) // Column 11 (ID)
```

### 3. Order Doesn't Matter in JavaScript Objects
```javascript
// These are identical:
{ id: 1, description: 'Test', amount: 100 }
{ amount: 100, id: 1, description: 'Test' }
```

### 4. Order MATTERS in Sheet Array Access
```javascript
// This is FIXED by column position:
const date = row[1];        // Always column 2
const description = row[4]; // Always column 5
```

---

## Files to Modify

### 1. `apps-script/Code.gs`
- [ ] Update `handleSaveReceipts()` - add ID generation
- [ ] Update `handleQueryReceipts()` - include ID in response
- [ ] Update `getOrCreateSheet()` - ensure ID header exists
- [ ] Add `handleUpdateReceipt()` - update by ID
- [ ] Add `handleDeleteReceipt()` - delete by ID
- [ ] Add `backfillMissingIds()` - migration function

### 2. `index.html`
- [ ] Add `section-edit` HTML
- [ ] Refactor field names (vendor → description)
- [ ] Update `receipts` array structure
- [ ] Update `saveReceipts()` - handle ID response
- [ ] Update `queryReceipts()` - handle ID field
- [ ] Update `renderReviewTable()` - use description, not vendor
- [ ] Update `addManualReceipt()` - use description
- [ ] Update `updateReceipt()` - use description
- [ ] Add `openEditPanel()` function
- [ ] Add `saveEditChanges()` function
- [ ] Add `deleteReceiptWithConfirm()` for edit panel
- [ ] Update `renderSummaryTable()` - add edit icons

---

## Testing Checklist (Complete)

### Step 1
- [ ] New receipts get UUID in column 11
- [ ] Query returns ID field
- [ ] Frontend `vendor` renamed to `description` everywhere
- [ ] No broken references after field rename

### Step 2
- [ ] Edit icon appears in summary table
- [ ] Click opens edit panel with correct data
- [ ] Edit panel layout matches review panel
- [ ] Back button returns to summary

### Step 3
- [ ] Save Edit updates correct row in sheet
- [ ] Modified_at updates, Created_at unchanged
- [ ] Query reflects updated data
- [ ] Other records unaffected

### Step 4
- [ ] Delete confirmation appears
- [ ] Delete removes correct row
- [ ] Summary refreshes after delete
- [ ] Other records unaffected

### Migration
- [ ] Backfill script assigns IDs to existing records
- [ ] Existing records editable after migration

---

## Estimated Effort (Revised)

| Step | Task | Time |
|------|------|------|
| 1 | Add ID column + field alignment | 45 min |
| 2 | Edit panel UI | 30 min |
| 3 | Update API + integration | 30 min |
| 4 | Delete functionality | 15 min |
| 5 | Migration script + testing | 30 min |

**Total: ~2.5 hours**

---

## Risk Mitigation

1. **Column order confusion:** Documented 0-based vs 1-based indices clearly above
2. **Field name mismatch:** Unified naming table prevents confusion
3. **Existing data:** Migration script handles backfill
4. **Breaking changes:** ID column appended (rightmost) = safest approach
5. **Testing:** Step-by-step testing after each phase
