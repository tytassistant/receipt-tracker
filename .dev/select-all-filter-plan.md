# Select All Filter Plan — Exclude "AI Review Attempted" Records

**Date:** 2026-06-13  
**Status:** Planned (not yet applied)

---

## Goal
When user clicks the **Select All** checkbox in the review panel, exclude records with status **"AI Review Attempted"** (`reviewed == "2"`). Individual record checkboxes remain fully clickable.

## Changes Required

### Step 1: Tag each checkbox with its review status at render time

**File:** `index.html` — `renderReviewCards()` function  
**Location:** ~line 2035 (inside the template string)

Change:
```html
<input type="checkbox" class="ai-review-select-cb">
```
To:
```html
<input type="checkbox" class="ai-review-select-cb" data-review-status="{{r.reviewed}}">
```

### Step 2: Filter Select All handler to skip status "2" records

**File:** `index.html` — event listener at ~line 3140-3144

**Before:**
```javascript
document.getElementById('reviewSelectAllCheckbox').addEventListener('change', function() {
    const selected = this.checked;
    document.querySelectorAll('[type="checkbox"].ai-review-select-cb').forEach(cb => cb.checked = selected);
});
```

**After:**
```javascript
document.getElementById('reviewSelectAllCheckbox').addEventListener('change', function() {
    const selected = this.checked;
    document.querySelectorAll('[type="checkbox"].ai-review-select-cb').forEach(cb => {
        if (cb.dataset.reviewStatus !== '2') {
            cb.checked = selected;
        }
    });
});
```

---

## Notes
- Dynamic `dataset` read means changes to the status dropdown are immediately reflected in Select All behavior — no re-render needed.
- Individual record clicking is unaffected across both changes.
- No CSS/structural changes required.
