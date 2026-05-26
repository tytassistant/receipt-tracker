# Receipt Tracker — Apps Script Change Plan

## Context

Google Apps Script (`Code.gs`) is the backend for the receipt tracker web app. It handles:
1. Image uploads to Google Drive (inside `receipts` / `receipt-tracker` folder)
2. Receipt data rows appended to a Google Sheet

## Current Problems

1. **Spreadsheet creation bug**: Code searches for `receipts.xlsx` (wrong name + wrong type) in the `receipts` folder → never finds it → calls `SpreadsheetApp.create()` which creates in root Drive → returns spreadsheet not in folder → next call searches again, doesn't find it, creates another → many duplicates at root
2. **Wrong file type**: `.xlsx` is Microsoft Excel; Google Sheets files have no extension, just name like `receipts-database`
3. **Wrong location**: Spreadsheet created at root Drive instead of inside `receipts` folder
4. **Wrong folder reference**: Code uses `DriveApp.getFoldersByName(RECEIPTS_FOLDER)` but `RECEIPTS_FOLDER = "receipts"` while Tony's folder is `receipt-tracker`
5. **Missing columns**: No `Record_no`, `Modified_at`, `Created_at` columns
6. **Wrong column order and names**: `Date, Description, Amount, Currency, Category, Remarks, Image_URL, Created_At` vs desired `Record_no, Date, Created_at, Modified_at, Description, Amount, Currency, Category, Remarks, Image_URL`
7. **Timezone**: All timestamps use Apps Script default timezone (likely UTC, not HKT)
8. **Date folder creation**: `getOrCreateReceiptFolder` creates `/receipts/YYYYMMDD/` but Tony's folder is `receipt-tracker` — need to verify correct folder name

---

## Detailed Change Plan

### 1. Fix Folder Name Constants

**File:** `Code.gs`

**Current:**
```javascript
const RECEIPTS_FOLDER = "receipts";
const SPREADSHEET_NAME = "receipts";
```

**Change to:**
```javascript
const RECEIPTS_FOLDER = "receipt-tracker";  // Tony's actual folder name
const SPREADSHEET_NAME = "receipts-database";
```

**Rationale:** Tony confirmed the Drive folder is named `receipt-tracker`, not `receipts`.

---

### 2. Fix `getOrCreateRootFolder()`

**Current:** Searches `DriveApp` root for folder named `RECEIPTS_FOLDER`

**Change:** Should search for the folder by name. The logic is mostly correct but needs to work relative to the actual folder structure.

```javascript
function getOrCreateRootFolder() {
  var folders = DriveApp.getFoldersByName(RECEIPTS_FOLDER);
  if (folders.hasNext()) {
    return folders.next();
  }
  // If folder doesn't exist at all, create it at root
  return DriveApp.createFolder(RECEIPTS_FOLDER);
}
```

**Note:** This stays as-is but verify `RECEIPTS_FOLDER` is `receipt-tracker`.

---

### 3. Fix `getOrCreateSheet()` — CRITICAL BUG FIX

**Current problems:**
- Searches for `SPREADSHEET_NAME + ".xlsx"` → `.xlsx` is wrong type
- Uses `SpreadsheetApp.create()` which creates at root, not inside the folder
- After creating, doesn't move to folder — so next call searches folder (doesn't find it), creates another at root

**New implementation:**

```javascript
function getOrCreateSheet() {
  var root = getOrCreateRootFolder();

  // Search for existing spreadsheet BY NAME inside this folder
  // Google Sheets files: name only, no extension
  var files = root.getFilesByName(SPREADSHEET_NAME);
  var spreadsheet;

  if (files.hasNext()) {
    // Found existing spreadsheet — open it
    var file = files.next();
    spreadsheet = SpreadsheetApp.openById(file.getId());
  } else {
    // Create NEW spreadsheet INSIDE the receipts folder
    // SpreadsheetApp.create() creates at root, so we:
    // 1. Create the spreadsheet
    // 2. Get the file reference
    // 3. Move it into the folder

    var ssId = SpreadsheetApp.create(SPREADSHEET_NAME).getId();
    var file = DriveApp.getFileById(ssId);

    // Add file to the root receipts folder
    root.addFile(file);

    // Remove from root (optional — keeps Drive root clean)
    DriveApp.getRootFolder().removeFile(file);

    spreadsheet = SpreadsheetApp.openById(ssId);
  }

  // Get or create "Receipts" sheet tab
  var sheetName = "Receipts";
  var sheet = spreadsheet.getSheetByName(sheetName)
               || spreadsheet.insertSheet(sheetName);

  // If sheet is empty (new), add header row
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    // Style header row
    sheet.getRange(1, 1, 1, COLUMNS.length)
      .setBackground("#f8f9fa")
      .setFontWeight("bold");
    spreadsheet.setFrozenRows(1);
  }

  return sheet;
}
```

**Key fixes:**
- Search for `SPREADSHEET_NAME` (no extension) in the folder
- On new creation: move file into folder using `root.addFile(file)` + `DriveApp.getRootFolder().removeFile(file)`
- Create a sheet tab named `Receipts` (not just Sheet1)

---

### 4. Update COLUMNS constant

**Current:**
```javascript
const COLUMNS = ["Date", "Description", "Amount", "Currency", "Category", "Remarks", "Image_URL", "Created_At"];
```

**Change to:**
```javascript
const COLUMNS = [
  "Record_no",    // a) Auto-incrementing integer
  "Date",         // b) From receipt data
  "Created_at",   // c) HKT timestamp of row creation
  "Modified_at",  // d) HKT timestamp, same as Created_at on insert
  "Description",  // e) From receipt data
  "Amount",       // f) From receipt data
  "Currency",     // g) From receipt data
  "Category",     // h) From receipt data
  "Remarks",      // i) From receipt data
  "Image_URL"     // j) From upload result
];
```

---

### 5. Update `handleSaveReceipts()` — Row Insert Logic

**Changes needed:**
1. Use new column order when building row array
2. Calculate `Record_no = max(existing Record_no) + 1`
3. Generate `Created_at` and `Modified_at` in HKT
4. Get `Image_URL` from the `imageUrl` field in the receipt data

**New implementation:**

```javascript
function handleSaveReceipts(data) {
  var receipts = data.receipts;
  if (!receipts || !Array.isArray(receipts) || receipts.length === 0) {
    return jsonResponse(400, { error: "receipts array is required" });
  }

  var sheet = getOrCreateSheet();
  var now = new Date();
  var createdAt = formatHKT(now);
  var modifiedAt = formatHKT(now);
  var savedCount = 0;

  for (var i = 0; i < receipts.length; i++) {
    var r = receipts[i];

    // Calculate next Record_no
    var lastRecordNo = 0;
    var colRecordNo = 1; // Column A is Record_no
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) { // Has data rows
      var lastNos = sheet.getRange(2, colRecordNo, lastRow - 1, 1).getValues();
      for (var j = 0; j < lastNos.length; j++) {
        if (lastNos[j][0] > lastRecordNo) {
          lastRecordNo = lastNos[j][0];
        }
      }
    }
    var newRecordNo = lastRecordNo + 1;

    var row = [
      newRecordNo,        // Record_no
      r.date || "",       // Date
      createdAt,          // Created_at (HKT)
      modifiedAt,         // Modified_at (HKT) — same on insert
      r.description || "",// Description
      parseFloat(r.amount) || 0,  // Amount
      r.currency || "HKD",// Currency
      r.category || "Others", // Category
      r.remarks || "",    // Remarks
      r.imageUrl || ""    // Image_URL
    ];

    sheet.appendRow(row);
    savedCount++;
  }

  return jsonResponse(200, {
    success: true,
    saved: savedCount,
    sheetUrl: sheet.getParent().getUrl()
  });
}
```

---

### 6. Add HKT Date Formatting Utility

**Add new function:**

```javascript
// Format date to HKT timezone string: "YYYY-MM-DD HH:mm:ss"
function formatHKT(date) {
  // Create a date formatter in HKT (UTC+8)
  // Apps Script uses the script's timezone setting
  var formatter = Utilities.newDateFormat('yyyy-MM-dd HH:mm:ss', 'GMT+8');
  return Utilities.formatDate(date, 'GMT+8', 'yyyy-MM-dd HH:mm:ss');
}
```

**Note:** The timezone is set in Apps Script project settings (File → Project Settings → Time zone). Should be set to `GMT+8:00 Hong Kong`.

---

### 7. Verify `getOrCreateReceiptFolder()` — Date Subfolder Logic

**Check current logic:**

```javascript
function getOrCreateReceiptFolder(folderDate) {
  var root = getOrCreateRootFolder();
  var subfolders = root.getFoldersByName(folderDate);
  if (subfolders.hasNext()) {
    return subfolders.next();
  }
  return root.createFolder(folderDate);
}
```

**Status:** This already creates date folders inside `receipt-tracker` (since `root = getOrCreateRootFolder()` returns the `receipt-tracker` folder). No changes needed — but verify `RECEIPTS_FOLDER` is `receipt-tracker`.

---

### 8. Update `handleUploadImage()` — Return Image URL

**Current:** Returns `fileUrl` in response but `imageUrl` key name may not match what index.html expects.

**Check in index.html `writeToSheet` function:**
```javascript
receipts: receipts.map(r => ({
  date: r.date,
  description: r.description || '',
  amount: r.amount,
  currency: r.currency || 'HKD',
  category: r.category || 'Others',
  remarks: r.remarks || '',
  imageUrl: r.imageUrl || ''  // from uploadToDrive result
}))
```

**Status:** `handleUploadImage` returns `fileUrl` in JSON. Need to check if index.html stores it as `imageUrl` when passing to `writeToSheet`. Looking at index.html `uploadToDrive` → the result passed has `fileUrl` → need to verify the field name mapping.

**Action needed in index.html:** When building receipts for `writeToSheet`, use the `fileUrl` from the `uploadToDrive` result as `imageUrl`.

This is a change in **index.html**, not Code.gs.

---

### 9. Apps Script Project Settings — Must Be Done Manually

Tony must set the Apps Script timezone manually:
1. Open Apps Script project → ⚙️ (Project Settings) → check "Time zone: GMT+08:00 Hong Kong"

---

## Summary of Changes by File

### Code.gs changes:
| # | Change | Type |
|---|--------|------|
| 1 | `RECEIPTS_FOLDER = "receipt-tracker"` | Constant fix |
| 2 | `SPREADSHEET_NAME = "receipts-database"` | Constant fix |
| 3 | Fix `getOrCreateSheet()` — no .xlsx, add file to folder | Bug fix |
| 4 | Update `COLUMNS` array with new order + new columns | Data fix |
| 5 | Rewrite `handleSaveReceipts()` — Record_no calc, HKT dates | Logic update |
| 6 | Add `formatHKT()` utility function | New function |
| 7 | Verify `getOrCreateReceiptFolder()` works with `receipt-tracker` folder | Verify |

### index.html changes:
| # | Change | Type |
|---|--------|------|
| 1 | Map `fileUrl` from upload result → `imageUrl` when building receipts for writeToSheet | Field mapping |

### Manual (Tony must do):
| # | Action |
|---|--------|
| 1 | Set Apps Script project timezone to GMT+08:00 Hong Kong |
| 2 | Delete all duplicate `receipts*` files at Drive root |

---

## Testing Plan After Deployment

1. Deploy new Apps Script version
2. Set timezone in project settings
3. Run a test receipt upload — verify:
   - New spreadsheet `receipts-database` appears inside `receipt-tracker` folder
   - Only ONE spreadsheet exists (no duplicates)
   - Date subfolder created if not exists
   - Row appended with correct column order and values
   - `Record_no` increments correctly
   - `Created_at` and `Modified_at` show HKT time
4. Upload second receipt — verify:
   - Same spreadsheet, new row appended
   - `Record_no` continues from previous max
   - No new spreadsheet created