# Change Plan: Summary Panel — Green Tick for Reviewed Entries

## Goal

Add a small green tick icon next to receipt entries in the summary panel (`section-welcome`) that have already been reviewed in Google Sheets. The `"Reviewed"` column (column M) on the sheet already tracks `0` or `1`.

---

## Gap Analysis

1. **Backend**: `handleQueryReceipts()` in `Code.gs` fetches COLUMNS.length = 12 columns (A–L). Column M (`Reviewed`) is never read or returned.
2. **Frontend**: Summary panel `<tbody>` at line ~1685 renders description, date, amount, edit — no reviewed indicator.

---

## Changes

### Change 1: `Code.gs` — `handleQueryReceipts()` (~line 386)

**Before:**
```javascript
// Get all needed columns: A-L (all COLUMNS)
var allDataRange = sheet.getRange(2, 1, rowsCount, COLUMNS.length);
var allData = allDataRange.getValues();
```

Add two more lines to fetch column M separately (minimal data transfer):
```javascript
// Get Reviewed column (M = 13) for matching rows
var reviewedRange = sheet.getRange(2, 13, rowsCount, 1).getValues();
```

Then in the receipt object push (~line ~407), add:
```javascript
reviewed: row[12]           // Column M: Reviewed (0 or 1)
```

### Change 2: `index.html` — summary table rendering (~line 1685)

**Before:**
```html
<td style="padding:10px 12px;">${escapeHtml(r.description || '-')}</td>
```

**After:**
```html
<td style="padding:10px 12px;">${escapeHtml(r.description || '-')} ${r.reviewed ? '<i class="fas fa-check-circle" style="color:var(--success); margin-left:6px; font-size:14px;" title="Reviewed"></i>' : ''}</td>
```

---

## Verification

- Upload new receipts, go to review records panel, click "Confirm" (which sets `reviewed = 1`).
- Return to summary panel and verify the green tick appears next to that row's description.
- Reload page after review — tick persists (data comes from sheet).

---

## Files Modified

| File | Line(s) | Change type |
|------|---------|-------------|
| `apps-script/Code.gs` | ~386 + receipt push block | Add Reviewed column fetch, add to output |
| `index.html` | ~1685 | Add check-circle icon in description TD |
