# Change Plan: Reviewed Field Ternary State (Verified / AI Review Attempted / Pending)

## Goal
Change the `Reviewed` column (`reviewed`) from binary (1 or 0) to ternary states, mapped as follows:

| UI Label           | Spreadsheet Value | Filter Behavior             |
|--------------------|-------------------|-----------------------------|
| **Pending Review** | empty / blank     | Shown in review panel       |
| **AI Review Attempted** | 2          | Shown in review panel       |
| **Verified**       | 1                 | **Excluded** from panel     |

Also replace the Reviewed checkbox with a dropdown.

---

## Backend Changes (Code.gs)

### Stage 1 — `handleQueryReviewed` filter logic (~line 763–792)

**Current:**
```javascript
for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    var dateCell = row[1]; // Column B
    var reviewedAt = row[13]; // Column N: Reviewed_at
    if (dateCell instanceof Date &&
        dateCell.getTime() >= startDateObj.getTime() &&
        dateCell.getTime() <= endDateObj.getTime() &&
        (!reviewedAt || reviewedAt === "")) {
```

**Change to:**
- Replace the `Reviewed_at` column filter with a `Reviewed` column (M = index 12) value check.
- Include only records where `row[12]` is **not equal to 1** (i.e., blank or 2).

**Result:**
```javascript
var reviewed = row[12]; // Column M: Reviewed
if (dateCell instanceof Date &&
    dateCell.getTime() >= startDateObj.getTime() &&
    dateCell.getTime() <= endDateObj.getTime() &&
    !isNaN(parseFloat(reviewed)) ? parseFloat(reviewed) !== 1 : true) {
```

Or simpler (since `parseInt` handles empty strings):
```javascript
if (dateCell instanceof Date &&
    dateCell.getTime() >= startDateObj.getTime() &&
    dateCell.getTime() <= endDateObj.getTime() &&
    parseInt(row[12]) !== 1) {
// Note: parseInt('') === NaN, and NaN !== 1 is true — so blank is included. This gives us the filter we need without worrying about string/int type mismatches.

### Stage 2 — `handleQueryReviewed` response mapping (~line 787)
**Current:** `reviewed: parseInt(row[12]) || 0`
**Change to:** Keep it exactly as-is. No change needed here — the client already uses truthy/falsy evaluation of `r.reviewed` (e.g., `${r.reviewed ? 'checked' : ''}` for dropdown value mapping later).

### Stage 3 — `handleSaveReviewed` save logic (~line 801–896)
**Current:** The backend determines `newReviewed` from `parseInt(rData.reviewed) || 0`, then writes to column M only: if `newReviewed == 1` (Verified), sets `reviewedAt` (timestamp in column N). Otherwise leaves it unchanged.

**Changes needed:**
- **Value mapping stays same** — the backend just reads and writes the raw numeric value from the spreadsheet. No additional routing logic needed beyond what already exists.
- The existing logic (`parseInt(rData.reviewed) || 0`) works: if client sends `'1'`, '2', or `''`/null, it correctly evaluates to `1`, `2`, or `0`. When writing back, we write `newReviewed` (which will be 1 or 2).
- **Keep Reviewed_at logic** unchanged — only set timestamp when Verified is written.

---

## Client-Side Changes (index.html)

### Stage 4 — `renderReviewCards()` HTML generation (~line 1990–2050)
Replace the existing card structure with a single dropdown per record that maps to the correct dropdown value based on the server response.

**Current (lines 2039-2045):**
```html
<div style="display:flex; justify-content:space-between;">
  <label>...</label>
</div>
```

**New structure:**
```html
<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:12px;">
  <!-- Left: Select for AI Review -->
  <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; color:var(--text-muted); user-select:none;">
    <input type="checkbox">
    Select for AI Review
  </label>
  
  <!-- Right: Review Status dropdown -->
  <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-muted);">
    <span>Review status:</span>
    <select id="review-status-${index}" style="padding:4px 8px;">
      <option value="">Pending Review</option>
      <option value="2">AI Review Attempted</option>
      <option value="1">Verified</option>
    </select>
  </div>
</div>
```

**How to set the default selected option:**
If `r.reviewed == ''`, "reviewed field is blank. If `r.reviewed` is 1, select value = "Pending" and if it's 2, select "AI Review Attempted".

### Stage 5 — `confirmReviewChanges()` save mapping (~line 2060–2080)
Map the dropdown selection to the corresponding numeric value:

```javascript
review: document.getElementById('review-status-' + index)?.value || '0' // Maps "1" → verified, "0" → blank
};
```

The backend (handleSaveReviewed) receives the raw string/int and writes it directly to column M in GSheets.

### Stage 6 — `reviewWithAI` success handling
When AI review completes for each record:
- **Verified** (amount matched): set dropdown value = "1" (Verified)
- **Mismatch/No figure/Error**: set dropdown value = "2" (AI Review Attempted)

Update the DOM element directly using a reference to the newly generated dropdown in the card.

---

## Completed Stages (in this session)

### Stage 1 — handleQueryReviewed filter logic ✅ APPLIED
Code.gs line ~768-772: `parseInt(row[12]) !== 1` replaces the old `Reviewed_at === ""` check.

### Stage 5a — confirmReviewChanges save mapping ✅ APPLIED
index.html line ~2068: Reads dropdown value with explicit null preservation for blank state:
```javascript
reviewed: (() => { const v = document.getElementById('review-status-' + index)?.value; return v ? parseInt(v) : null; })()
```

### Stage 5b — reviewWithAI verified path ✅ APPLIED  
Line ~2213: Sets dropdown to `"1"` (Verified) on match.

### Stage 5c — reviewWithAI mismatch path ✅ APPLIED
Line ~2225: Sets dropdown to `"2"` ("AI Review Attempted") for Category A failures.

### Stage 5d — reviewWithAI no-figure path ✅ APPLIED
Line ~2238: Sets dropdown to `"2"` for Category B failures.

### Stage 5e — reviewWithAI error path ✅ APPLIED
Line ~2257: Sets dropdown to `"2"` for Category C errors.

---

After applying changes, test the following in sequence:
1. Load review panel for date range with unreviewed records — all should appear.
2. Record has value `1` in Reviewed column M — it should still be shown in a record where you set Verified and save (it should not appear in the review panel if reviewed != 1).
