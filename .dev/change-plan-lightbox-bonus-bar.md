# Change Plan: Lightbox Bonus Bar (Previous/Next + Amount + Verified)

**Scope:** Add a bottom info bar in the existing lightbox overlay with: previous/next navigation arrows, formatted amount display, and a "Verified" button that updates the current record inline.

**No new files or browser-level features — entirely within index.html.**

---

## STEP 1 — Update `openLightbox()` to accept and track an index

**File:** `index.html`
**Location:** Line 2552–2555

### Before:
```js
function openLightbox(dataUrl) {
  document.getElementById('lightboxImg').src = dataUrl;
  document.getElementById('lightbox').classList.add('open');
}
```

### After:
```js
let currentLightboxIndex = -1; // new global state variable (add to line ~1375, after `let photos`, before `let receipts`)

function openLightbox(dataUrl, recordIndex) {
  document.getElementById('lightboxImg').src = dataUrl;
  currentLightboxIndex = (typeof recordIndex === 'number') ? recordIndex : -1;
  updateLightboxInfoBar();
  document.getElementById('lightbox').classList.add('open');
}
```

**Changes:**
- Accept optional `recordIndex` parameter.
- Update `currentLightboxIndex` global, default `-1` if omitted or not a number.
- Call `updateLightboxInfoBar()` to render the bottom bar (new in Step 2).

---

## STEP 2 — Add HTML for the lightbox info bar

**File:** `index.html`
**Location:** Line 1342–1348 (inside the existing `<div class="lightbox-overlay" id="lightbox">`)

### Before:
```html
<!-- Lightbox -->
<div class="lightbox-overlay" id="lightbox">
  <button class="lightbox-close" id="lightboxClose"><i class="fas fa-xmark"></i></button>
  <div class="lightbox-img-wrap">
    <img id="lightboxImg" src="" alt="Receipt">
  </div>
</div>
```

### After:
```html
<!-- Lightbox -->
<div class="lightbox-overlay" id="lightbox">
  <button class="lightbox-close" id="lightboxClose"><i class="fas fa-xmark"></i></button>
  <div class="lightbox-img-wrap">
    <img id="lightboxImg" src="" alt="Receipt">
  </div>
  <!-- Bottom info bar -->
  <div class="lightbox-bottom-bar" id="lightboxBottomBar">
    <button class="lightbox-nav-btn" id="lightboxPrevBtn" title="Previous record">
      <i class="fas fa-chevron-left"></i>
    </button>
    <span class="lightbox-amount-display" id="lightboxAmountDisplay"></span>
    <button class="lightbox-verified-btn" id="lightboxVerifiedBtn">
      Verify &amp; Save
    </button>
    <button class="lightbox-nav-btn" id="lightboxNextBtn" title="Next record">
      <i class="fas fa-chevron-right"></i>
    </button>
  </div>
</div>
```

**Changes:** Added `<div class="lightbox-bottom-bar">` with four child elements: previous arrow, amount display (static text), Verify button, next arrow. The bar sits below the image inside the overlay.

---

## STEP 3 — Add CSS for the bottom info bar

**File:** `index.html`
**Location:** After line 790 (after existing lightbox styles, before "Sync Progress" at line 792)

### Insert after line 790:
```css
    /* Lightbox bottom info bar */
    .lightbox-bottom-bar {
      position: absolute;
      bottom: 24px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; justify-content: center; gap: 48px;
      background: rgba(30,30,26,0.85);
      padding: 10px 28px 10px 28px;
      border-radius: var(--radius-lg); z-index: 5;
    }

    .lightbox-nav-btn {
      background: rgba(255,255,255,0.12);
      border: none; color: #fff; font-size: 20px; width: 42px; height: 42px;
      border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: var(--transition);
    }
    .lightbox-nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
    .lightbox-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    .lightbox-amount-display {
      color: var(--accent);
      font-size: 18px; font-weight: 700; letter-spacing: -0.3px;
      min-width: 80px; text-align: center; user-select: none;
    }

    .lightbox-verified-btn {
      background: linear-gradient(135deg, var(--green-primary), var(--green-light));
      border: none; color: #fff; font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 14px; font-weight: 600; padding: 8px 20px; border-radius: var(--radius-sm);
      cursor: pointer; transition: var(--transition);
    }
    .lightbox-verified-btn:hover:not(:disabled) { opacity: 0.9; }
    .lightbox-verified-btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

---

## STEP 4 — Add `updateLightboxInfoBar()` function

**File:** `index.html`
**Location:** After `closeLightbox()` (line 2559), before line 2561

### Insert at line ~2560:
```js
// Lightbar info bar for the lightbox
function updateLightboxInfoBar() {
  const bar = document.getElementById('lightboxBottomBar');
  const prevBtn = document.getElementById('lightboxPrevBtn');
  const nextBtn = document.getElementById('lightboxNextBtn');
  const amountEl = document.getElementById('lightboxAmountDisplay');
  const verifiedBtn = document.getElementById('lightboxVerifiedBtn');

  if (currentLightboxIndex < 0 || currentLightboxIndex >= reviewRecords.length) {
    // No valid record — hide the bar (fallback to old behaviour)
    bar.style.display = 'none';
    return;
  }

  const r = reviewRecords[currentLightboxIndex];
  bar.style.display = 'flex';

  // Amount display: "<CURRENCY> <amount>"
  amountEl.textContent = [r.currency, r.amount].filter(Boolean).join(' ') || '\u2014';

  // Previous/Next navigation bounds
  prevButton.disabled = (currentLightboxIndex === 0);
  nextBtn.disabled = (currentLightboxIndex === reviewRecords.length - 1);

  // Verified button state
  const isVerified = r.reviewed == '1' || r.reviewed === 1;
  verifiedBtn.disabled = isVerified;
  verifiedBtn.innerHTML = isVerified
    ? '<i class="fas fa-check" style="margin-right:4px"></i>Verified'
    : 'Verify &amp; Save';
}

// Next record in sequence
function goToNextRecord() {
  if (currentLightboxIndex >= 0 && currentLightboxIndex < reviewRecords.length - 1) {
    currentLightboxIndex++;
    loadRecordImageIntoLightbox(currentLightboxIndex);
    updateLightboxInfoBar();
  }
}

// Previous record in sequence
function goToPrevRecord() {
  if (currentLightboxIndex > 0 && currentLightboxIndex >= reviewRecords.length) {
    currentLightboxIndex--;
    loadRecordImageIntoLightbox(currentLightboxIndex);
    updateLightboxInfoBar();
  }
}

// Trigger "Verify & Save" on current lightbox record
function handleVerifyInLightbox() {
  if (currentLightboxIndex < 0 || currentLightboxIndex >= reviewRecords.length) return;
  const r = reviewRecords[currentLightboxIndex];
  r.reviewed = '1'; // set Verified

  // Sync the on-screen status dropdown for this record
  const statusSelect = document.getElementById('review-status-' + currentLightboxIndex);
  if (statusSelect) statusSelect.value = '1';

  updateLightboxInfoBar();
}

// Load a record's image URL into the lightbox via google thumbnail helper
function loadRecordImageIntoLightbox(recordIndex) {
  const r = reviewRecords[recordIndex];
  if (!r || !r.imageUrl) return;
  const fileIdMatch = r.imageUrl.match(/\/\/([^/]+)\.googleusercontent\.com\/d\?id=([^&]+)/);
  let url = '';
  if (fileIdMatch) {
    // Google Drive Image Viewer format (cross-origin renderable)
    url = 'https://' + fileIdMatch[1] + '.googleusercontent.com/d?id=' + fileIdMatch[2];
  } else {
    // Fallback: use thumbnail URL with original fileId if present
    const fileId = r.imageUrl?.match(/file\/d\/([^/?]+)/)?.[1];
    if (fileId) url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
  }
  document.getElementById('lightboxImg').src = url;
}
```

---

## STEP 5 — Update `renderReviewCards()` to pass index and wire event listeners

**File:** `index.html`
**Location:** Line 1998 (the thumbnail `<img>` click handler)

### Before (line 1998):
```html
<img src="${thumbUrl}" class="receipt-card-thumb" style="width:64px; height:64px; object-fit:cover; border-radius:8px; cursor:pointer; flex-shrink:0;" onclick="openLightbox('https://drive.google.com/thumbnail?id=${fileId}&sz=w800')" onerror="this.style.display='none'">
```

### After:
```html
<img src="${thumbUrl}" class="receipt-card-thumb" style="width:64px; height:64px; object-fit:cover; border-radius:8px; cursor:pointer; flex-shrink:0;" onclick="openLightbox('https://drive.google.com/thumbnail?id=${fileId}&sz=w800', ${index})" onerror="this.style.display='none'">
```

**Change:** Add `, ${index}` as the second argument to `openLightbox()`.

---

## STEP 6 — Wire up event listeners for the new buttons

**File:** `index.html`
**Location:** Line ~3162 (inside the DOMContentLoaded init block, near existing lightbox listener)

### Before:
```js
// Lightbox
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', (e) => {
  // ...click on bg to close...
});
```

### After:
```js
// Lightbox
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target === document.getElementById('lightbox')) closeLightbox();
});
document.getElementById('lightboxPrevBtn').addEventListener('click', goToPrevRecord);
document.getElementById('lightboxNextBtn').addEventListener('click', goToNextRecord);
document.getElementById('lightboxVerifiedBtn').addEventListener('click', handleVerifyInLightbox);

// Also allow keyboard: Left/Right for navigation, V to verify, Esc to close
document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
  if (e.key === 'ArrowLeft' && currentLightboxIndex > 0) goToPrevRecord();
  if (e.key === 'ArrowRight' && currentLightboxIndex < reviewRecords.length - 1) goToNextRecord();
});
```

---

## Summary of all changes by file & line

| Step | File | Line(s) | Change type | Description |
|------|------|---------|-------------|-------------|
| 1 | `index.html` | ~1375 (state block) + ~2552-2560 | Modify | Add `currentLightboxIndex` global; update `openLightbox(dataUrl, recordIndex)` to accept index and call `updateLightboxInfoBar()` |
| 2 | `index.html` | 1342–1348 (lightbox HTML) | Insert | Add `<div class="lightbox-bottom-bar">` with 4 child elements inside the existing lightbox overlay |
| 3 | `index.html` | ~790 (after CSS lightbox section, before sync progress) | Insert | CSS for `.lightbox-bottom-bar`, `.lightbox-nav-btn`, `.lightbox-amount-display`, `.lightbox-verified-btn` |
| 4 | `index.html` | ~2560 (after `closeLightbox`) | Insert | Functions: `updateLightboxInfoBar()`, `goToNextRecord()`, `goToPrevRecord()`, `handleVerifyInLightbox()`, `loadRecordImageIntoLightbox()` |
| 5 | `index.html` | 1998 | Modify | Add `, ${index}` to `openLightbox()` call in thumbnail `onclick` |
| 6 | `index.html` | ~3162 (init block) | Extend | Wire up event listeners for prev/next/verify buttons + keyboard navigation (Left/Right/Escape/V) |

---

## Verification commands after applying:

```bash
# Validate HTML structure is intact
grep -c '<div class="lightbox-overlay" id="lightbox">' /home/shared/documents/programs/receipt-tracker/index.html  # should be 1
grep -c 'currentLightboxIndex' /home/shared/documents/programs/receipt-tracker/index.html  # should be 5+
grep -c 'lightboxBottomBar' /home/shared/documents/programs/receipt-tracker/index.html      # should be 3+

# Check no syntax errors in the JS file
node --check <(head -n 1 index.html; sed '1s/.*/<script>/; /<\/script>$/d' /home/shared/documents/programs/receipt-tracker/index.html | tail -n +2 | head -n $(grep -n '</script>' /home/shared/documents/programs/receipt-tracker/index.html | tail -1 | cut -d: -f1))

# Verify step 5: confirm index argument was added to openLightbox call
grep "onclick=\"openLightbox" /home/shared/documents/programs/receipt-tracker/index.html # should contain ', ${index})'
```
