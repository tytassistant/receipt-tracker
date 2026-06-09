# Sort Review Cards by Descending Date

## Problem
Review records panel displays receipts in whatever order the backend returns. Same descending date sort as summary panel.

## Change Location
`/home/shared/documents/programs/receipt-tracker/index.html`, line ~1805 (inside `showReviewPanel()` function), **between** assigning `reviewRecords` and calling `renderReviewCards()`.

## Context / Data Flow

1. Backend returns `{ success, receipts: [...] }`
2. Line 1805: `reviewRecords = result.receipts;` (raw assignment)
3. Line 1806: `renderReviewCards(reviewRecords);` (renders card DOM)

### Why index consistency matters here (vs summary panel):
- Card input IDs use indices: `review-desc-${index}`, `review-date-${index}`, etc. → these are generated during rendering
- Save flow (line 1880–1887): `document.getElementById('review-desc-' + index)` — reads DOM inputs by index, maps back to `reviewRecords[index]`

### Critical: if we sort `reviewRecords` in-place BEFORE rendering, all three pieces stay aligned:
1. `reviewRecords[i]` → matches data for card at position `i`
2. Card's input IDs (`review-field-${i}`) → consistent with DOM position
3. Save loop reads correct values via same indices

## Plan

Insert sort block **between** lines 1805 and 1806:

```js
// After (line 1805):
reviewRecords = result.receipts;

// INSERT SORT BLOCK:
// Sort by date descending, stable (ties keep original order)
reviewRecords.sort((a, b) => {
  const da = new Date(a.date);
  const db = new Date(b.date);
  return db - da;
});

// Before (line 1806):
renderReviewCards(reviewRecords);
```

## Notes
- Inline sort — same approach as summary panel fix (`index.html` line ~1670)
- Data format: `r.date` is ISO `YYYY-MM-DD` → `new Date()` parses correctly
- ES2019+ stable sort guarantees ties preserve original order
