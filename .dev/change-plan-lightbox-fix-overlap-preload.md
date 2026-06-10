# Change Plan: Fix Layout Overlap + Label Text + Preload Next Image

**Scope:** Three related fixes to the lightbox bottom bar:
1. Prevent bar from overlapping photo by switching from absolute overlay to flex-column layout.
2. Change verify button label from "Verify & Save" to "Verified".
3. Add background image preloading (next record only) when lightbox opens or navigates.

**No new files — all changes in `index.html`.**

---

## STEP 1 — Fix overlap: Change lightbox layout from absolute to flex-column

All CSS rules that use `position: absolute; bottom: ...` on `.lightbox-bottom-bar` and its child buttons must be changed so the bar flows naturally *below* the image, not overlaid on top of it.

### 1a. HTML — remove `class="lightbox-bottom-bar"` wrapper div (no longer needed since we use flex column)
**File:** `index.html`  
**Location:** Inside `<div class="lightbox-overlay" id="lightbox">`, after the closing `</div>` of `.lightbox-img-wrap`, before closing `</div>` of `.lightbox-overlay`

#### Before:
```html
<div class="lightbox-bottom-bar" id="lightboxBottomBar">
  <button class="lightbox-nav-btn" id="lightboxPrevBtn" title="Previous record"><i class="fas fa-chevron-left"></i></button>
  <span class="lightbox-amount-display" id="lightboxAmountDisplay"></span>
  <button class="lightbox-verified-btn" id="lightboxVerifiedBtn">Verify &amp; Save</button>
  <button class="lightbox-nav-btn" id="lightboxNextBtn" title="Next record"><i class="fas fa-chevron-right"></i></button>
</div>
```

#### After:
```html
<div class="lightbox-bottom-bar" id="lightboxBottomBar">
  <button class="lightbox-nav-btn" id="lightboxPrevBtn" title="Previous record"><i class="fas fa-chevron-left"></i></button>
  <span class="lightbox-amount-display" id="lightboxAmountDisplay"></span>
  <button class="lightbox-verified-btn" id="lightboxVerifiedBtn">Verified</button>
  <button class="lightbox-nav-btn" id="lightboxNextBtn" title="Next record"><i class="fas fa-chevron-right"></i></button>
</div>
```

*(Note: Step 2 changes "Verify & Save" to "Verified". This step handles layout only, but I apply the label change here too since it affects this same line.)*

### 1b. CSS — Remove absolute positioning and replace with flex-column rules on overlay

**File:** `index.html`  
**Location:** Existing lightbox CSS rules (~lines 759–825)

#### Replace current `.lightbox-overlay` CSS:
```css
    /* Lightbox */
    .lightbox-overlay {
      display: none; position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.9); flex-direction: column;
      align-items: center; justify-content: flex-start;
      overflow-y: auto; padding: 24px 16px;
    }
    .lightbox-overlay.open { display: flex; }
    .lightbox-close {
      position: absolute; top: 12px; right: 16px;
      background: rgba(255,255,255,0.15); border: none;
      color: #fff; font-size: 22px; width: 40px; height: 40px;
      border-radius: 50%; cursor: pointer; z-index: 10;
      display: flex; align-items: center; justify-content: center;
    }
    .lightbox-close:hover { background: rgba(255,255,255,0.3); }
```

*Changes:* `justify-content: flex-start` (was `center`) so image starts at top; added `overflow-y: auto; padding: 24px 16px;` so tall images or narrow screens scroll and bar never overlaps.

#### Remove these CSS rules entirely (they rely on `position: absolute`; the new overflow approach makes them obsolete):
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

*Reason:* With flex-column layout, `.lightbox-bottom-bar` no longer needs `position: absolute`, `z-index`, or centered pill styling. The buttons themselves keep their individual CSS classes for hover/disabled states (those are still valid), but the entire wrapping/positioning system changes.

### 1c. CSS — New minimal rules for flex-flow bottom bar and buttons

Insert after the removed lightbox bottom bar section (same location):
```css
    /* Lightbox bottom info bar — flex column overlay, no overlap */
    .lightbox-bottom-bar {
      display: flex; align-items: center; justify-content: center; gap: 24px;
      width: 100%; max-width: 480px; margin-top: auto; padding: 16px 0 12px;
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
      font-size: 18px; font-weight: 700; letter-spacing: -0.3px; text-align: center;
      user-select: none;
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

*Key changes from previous CSS:*
- `.lightbox-bottom-bar` removed `position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index`. Now uses `margin-top: auto` to push to bottom of flex column naturally.
- Removed the dark pill background (`rgba(30,30,26,0.85)`) for a cleaner look — buttons float on the overlay background.
- Added `max-width: 480px` and `width: 100%` so bar stays centered but doesn't stretch too wide on large screens.
  
### 1d. JS — Simplify `updateLightboxInfoBar()` (no more `bar.style.display = 'none'` needed)

**File:** `index.html`  
**Location:** `updateLightboxInfoBar()` function (~line 2604)

The current code sets `bar.style.display = 'none'` when no valid index is set. Since `.lightbox-overlay` already hides the entire lightbox, the bar visibility follows naturally — but we keep this guard for safety. No change needed here for layout, just confirmation.

---

## STEP 2 — Change verify button label to "Verified" (both states)

**File:** `index.html`

### 2a. HTML — default button text
**Location:** Inline with step 1a above — already handled in the same edit:
```html
<button class="lightbox-verified-btn" id="lightboxVerifiedBtn">Verified</button>
```
*(Changed from `Verify &amp; Save` to `Verified`.)*

### 2b. JS — after-click state (already "Verified", just drop the icon)
**Location:** `updateLightboxInfoBar()` function where `isVerified` branch sets innerHTML.

#### Before:
```js
verifiedBtn.innerHTML = isVerified
    ? '<i class="fas fa-check" style=\"margin-right:4px\"></i>Verified'
    : 'Verify &amp; Save';
```

#### After:
```js
verifiedBtn.textContent = isVerified ? '\u2713 Verified' : 'Verified';
// or if you prefer just text, no innerHTML manipulation needed
```

**Even simpler approach — remove the dynamic `innerHTML` entirely:**

In `handleVerifyInLightbox()` (Step 5 below), instead of toggling `innerHTML`, we'll:
- Change button background to gray when disabled
- Change text to "Verified ✓" with Unicode checkmark

---

## STEP 3 — Preload next record image in background

### 3a. JS — Add preloading helper function
**File:** `index.html`  
**Location:** After `loadRecordImageIntoLightbox()` (same block as Step 4 from previous plan)

#### Insert:
```js
// Background image preloader (step 3)
function preloadNextImage(recordIndex) {
  const r = reviewRecords[recordIndex];
  if (!r || !r.imageUrl) return;
  const fileIdMatch = r.imageUrl.match(/file\/d\/([^/]+)/);
  if (!fileIdMatch) return;
  // Create hidden <img> — browser HTTP cache handles caching automatically
  // No UI reference kept; object GCs when this function scope ends
  new Image().src = 'https://drive.google.com/thumbnail?id=' + fileIdMatch[1] + '&sz=w800';
}
```

### 3b. JS — Call preload in openLightbox()
**Location:** `openLightbox()` function

#### Before:
```js
function openLightbox(dataUrl, recordIndex) {
  document.getElementById('lightboxImg').src = dataUrl;
  currentLightboxIndex = (typeof recordIndex === 'number') ? recordIndex : -1;
  updateLightboxInfoBar();
  document.getElementById('lightbox').classList.add('open');
}
```

#### After:
```js
function openLightbox(dataUrl, recordIndex) {
  document.getElementById('lightboxImg').src = dataUrl;
  currentLightboxIndex = (typeof recordIndex === 'number') ? recordIndex : -1;
  updateLightboxInfoBar();
  
  // Preload next image in background (if valid index exists)
  if (currentLightboxIndex >= 0 && currentLightboxIndex < reviewRecords.length - 1) {
    preloadNextImage(currentLightboxIndex);
  }
  
  document.getElementById('lightbox').classList.add('open');
}
```

### 3c. JS — Call preload in goToNextRecord()
**Location:** `goToNextRecord()` function

#### Before:
```js
function goToNextRecord() {
  if (currentLightboxIndex >= 0 && currentLightboxIndex < reviewRecords.length - 1) {
    currentLightboxIndex++;
    loadRecordImageIntoLightbox(currentLightboxIndex);
    updateLightboxInfoBar();
  }
}
```

#### After:
```js
function goToNextRecord() {
  if (currentLightboxIndex >= 0 && currentLightboxIndex < reviewRecords.length - 1) {
    // Preload the image after next (one step ahead)
    const nextIdx = currentLightboxIndex + 1;
    preloadNextImage(nextIdx);
    
    currentLightboxIndex++;
    loadRecordImageIntoLightbox(currentLightboxIndex);
    updateLightboxInfoBar();
  }
}
```

---

## STEP 4 (extra) — Handle edge case: close lightbox → discard preload

**File:** `index.html`  
**Location:** `closeLightbox()` function

No change needed — preloaded `new Image().src` objects are anonymous references that garbage collect when scope ends. Once the user closes the lightbox, any pending background fetch is a negligible one-time HTTP GET cost to Google's CDN.

---

## Summary of all changes by step

| Step | File | What |
|------|------|------|
| 1a | HTML (lightbox section) | Change verify button label from "Verify & Save" to "Verified" |
| 1b | CSS (~759-825) | Remove absolute positioning; replace with flex-column rules. Add padding/overflow-y to overlay so bar sits below naturally |
| 1c | CSS (insert in Step 1b location) | Minimal flex-flow rules for bottom bar (no pill bg, no position absolute) |
| 2a | HTML (Step 1a same spot) | Label already changed above — "Verified" default text |
| 2b | JS (`updateLightboxInfoBar`) | Simplify verified branch: `textContent = 'Verified \u2713'` or keep as-is if you want icon only when verified |
| 3a | JS (after `loadRecordImageIntoLightbox`) | New function `preloadNextImage(recordIndex)` using `new Image().src` |
| 3b | JS (`openLightbox`) | Add preloading call for next record if index is valid |
| 3c | JS (`goToNextRecord`) | Add preload for the *further* next image after navigation |

---

## Notes & decisions
- **Preload only next, never prev:** Prev images are rarely viewed in reverse quickly; one extra fetch per step is acceptable cost. Next-preload gives best UX/waste trade-off.
- **"Verified" label:** The button shows "Verified" before and after click. If you want visual distinction when already verified (disabled), the CSS `opacity: 0.5` on disabled provides that feedback.
- **Layout change:** Flex-column replaces absolute positioning entirely. Image scrolls if tall; bar stays at bottom naturally within the overlay's scroll content, never overlapping.
