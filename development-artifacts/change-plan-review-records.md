# Review Records Feature — Implementation Plan

## Overview
Add a "Review Records" panel that lets users review unreviewed receipts, mark them as reviewed, and save to Google Sheets.

---

## 1. Backend Changes

### 1a. `Code.gs` — Column Definitions

Add two columns to `COLUMNS` array:

| Col | Name | Type |
|-----|------|------|
| 13 | `Reviewed` | 0 or 1 |
| 14 | `Reviewed_at` | HKT timestamp (e.g. "2026-05-29 11:30:45") or empty |

### 1b. `handleQueryReviewed` — New Endpoint

**Request:**
```json
{
  "action": "queryReviewed",
  "token": "...",
  "data": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
}
```

**Behavior:**
- Same date range filtering as `handleQueryReceipts`
- Filter: only return rows where `Reviewed_at == ""` (not yet reviewed)
- Return all fields including the new `reviewed` and `reviewedAt` fields

**Response:**
```json
{
  "success": true,
  "receipts": [
    {
      "id": "uuid",
      "recordNo": 1,
      "date": "2026-05-28",
      "description": "Vendor",
      "amount": 123.45,
      "currency": "HKD",
      "category": "Food",
      "remarks": "",
      "imageUrl": "https://...",
      "imageName": "20260528_103045_receipt.jpg",
      "createdAt": "2026-05-28 10:30:45",
      "modifiedAt": "2026-05-28 10:30:45",
      "reviewed": 0,
      "reviewedAt": ""
    }
  ],
  "count": 15
}
```

### 1c. `handleSaveReviewed` — New Endpoint

**Request:**
```json
{
  "action": "saveReviewed",
  "token": "...",
  "data": {
    "receipts": [
      {
        "id": "uuid",
        "description": "Updated vendor",
        "date": "2026-05-28",
        "amount": 123.45,
        "currency": "HKD",
        "category": "Food",
        "remarks": "",
        "reviewed": 1
      }
    ]
  }
}
```

**Behavior for each receipt:**
1. Find row by `id` (col 12)
2. If `reviewed == 1` and row's `Reviewed` is currently 0 (first review) → set `Reviewed_at = formatHKT(now)` (HK timestamp)
3. If `reviewed == 1` and row's `Reviewed` is already 1 → `Reviewed_at` unchanged
4. If `reviewed == 0` → set `Reviewed_at = ""` (clear timestamp on uncheck)
5. Update all other fields (description, date, amount, currency, category, remarks)
6. Update `Modified_at` to current time

**Response:**
```json
{
  "success": true,
  "saved": 5
}
```

### 1d. Wire in `doPost`

Add to `doPost()` action routing:
```javascript
} else if (action === "queryReviewed") {
  return handleQueryReviewed(data);
} else if (action === "saveReviewed") {
  return handleSaveReviewed(data);
}
```

---

## 2. Frontend Changes

### 2a. Rename Button in Summary Panel

- Change "View / Edit Detailed Records" → "Review Records"
- Only visible if `config.poeKey` is truthy
- Clicking navigates to Review Records panel (not the existing detail view)

### 2b. New `section-review-records` Panel

**HTML Structure:**
- Header: "Review Records" with date range display (read-only, same as summary)
- List area: scrollable receipt cards (one per record)
- Action bar: [Back] [Confirm] buttons

### 2c. Receipt Card (per row in Review panel)

Each card shows:
- Small thumbnail (clickable for lightbox)
- Description — inline editable text input
- Date — date picker
- Amount — number input
- Currency — select dropdown
- **Reviewed** — toggle/checkbox (defaults to unchecked)

### 2d. Frontend State

```javascript
// New global state
let reviewRecords = []; // receipts fetched for review
```

### 2e. API Calls

```javascript
// Fetch unreviewed records
async function queryReviewedReceipts(startDate, endDate) { ... }

// Save all reviewed records
async function saveReviewedReceipts() { ... }
```

### 2f. Confirm Button Behavior

1. Call `queryReceipts` → `saveReviewedReceipts` for all records
2. Show success toast with count saved
3. Return to Summary panel

### 2g. Navigation

- `sections.reviewRecords.classList.add('visible')` to show
- Back button → `showWelcomePanel()` to return

---

## 3. Google Sheet Structure (Final)

| Col | Name |
|-----|------|
| A | Record_no |
| B | Date |
| C | Created_at |
| D | Modified_at |
| E | Description |
| F | Amount |
| G | Currency |
| H | Category |
| I | Remarks |
| J | Image_name |
| K | Image_URL |
| L | ID |
| M | Reviewed |
| N | Reviewed_at |

---

## 4. Files to Modify

| File | Changes |
|------|---------|
| `apps-script/Code.gs` | COLUMNS (add M, N), new handleQueryReviewed, new handleSaveReviewed, wire in doPost |
| `index.html` | section-review-records HTML, sections map entry, button rename, queryReviewedReceipts(), saveReviewedReceipts(), event listeners, review state |
| `development-artifacts/change-plan-review-records.md` | This plan |

---

## 5. Implementation Order

1. `Code.gs` — COLUMNS + `handleQueryReviewed`
2. `Code.gs` — `handleSaveReviewed`
3. `Code.gs` — wire in doPost
4. `index.html` — section-review-records HTML
5. `index.html` — sections map + state
6. `index.html` — button rename + visibility
7. `index.html` — queryReviewedReceipts() + saveReviewedReceipts()
8. `index.html` — event listeners (Back, Confirm)
9. Test: query, edit, save, verify sheet updated

---

## 6. Testing Checklist

- [ ] `queryReviewed` returns only unreviewed records (Reviewed_at == "")
- [ ] `saveReviewed` sets Reviewed_at on first review (Reviewed 0→1)
- [ ] `saveReviewed` does NOT reset Reviewed_at on subsequent saves
- [ ] Reviewed_at cleared when Reviewed toggled back to 0
- [ ] Edited fields (description, date, amount) saved correctly
- [ ] Back button returns to Summary
- [ ] Button hidden when no Poe key
- [ ] Date range filter works correctly
- [ ] Thumbnail loads and lightbox works