# Sort Summary Panel by Descending Date

## Problem
Summary panel displays receipt entries in whatever order the backend returns them. User wants descending date order (newest first), with original order preserved for same-date ties.

## Change Location
`/home/shared/documents/programs/receipt-tracker/index.html`, lines ~1660–1683 (`populateSummaryPanel` function).

## Context / Data Flow
1. Backend returns `{ success, count, totalAmount, receipts: [{ description, date, amount, currency, ...}], timing }`
2. Line 1668: `window.summaryReceipts = result.receipts` (raw array)
3. Line 1672: `result.receipts.map((r, index) => ...)` renders table rows — the `index` feeds into `openEditPanel(index)` for Edit buttons

## Plan

After line 1668 (**after** global receipt storage), sort in-place descending by date. Then use the sorted array for rendering instead of `result.receipts`. This ensures `window.summaryReceipts` and the table stay consistent — critical because Edit button indices reference elements in `window.summaryReceipts`.

### Code changes:

```javascript
// After: window.summaryReceipts = result.receipts;

// Sort by date descending, stable (ties keep original order)
window.summaryReceipts.sort((a, b) => {
  const da = new Date(a.date);
  const db = new Date(b.date);
  return db - da;  // descending
});

const receipts = window.summaryReceipts;

// Render with sorted array (line 1672 change: result.receipts -> receipts)
const tbody = document.getElementById('summaryTableBody');
tbody.innerHTML = receipts.map((r, index) => `
```

### What changes:
- Lines ~1668-1672: Insert sort block between storage and rendering
- Line ~1672: Replace `result.receipts` with `receipts` variable in the map call

### Notes:
- Using `new Date()` because dates appear in ISO format (`YYYY-MM-DD`)
- JS `Array.prototype.sort` is guaranteed stable since ES2019 — ties will preserve original order (no secondary sort needed per user request)
- No HTML/UI changes required (no visual tweak for "sorted by date" indicator)
