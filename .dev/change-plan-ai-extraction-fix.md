# Change Plan: Fix AI Extraction & Error Toast Issues

## Issues Summary

### Issue 1: AI Mode Fails with Multiple Photos
- **Symptom:** When multiple photos are uploaded and AI extraction is enabled, extraction fails
- **Current behavior:** Process gets stuck, "Analyzing" keeps flashing
- **Root cause (suspected):** Error handling in the extraction loop may not properly reset state

### Issue 2: Toast Appears Only After Screen Tap
- **Symptom:** Error toast doesn't appear until user interacts with screen
- **Root cause (suspected):** CSS transition or rendering timing issue

### Issue 3: Error Toast Disappears Too Quickly  
- **Current:** Auto-dismiss after 3 seconds via `setTimeout`
- **Desired:** Manual dismiss with X button

---

## Sub-Step Implementation Plan

### Sub-Step 1: Fix AI Extraction Error Handling
**File:** `index.html` (JavaScript - `extractReceipts()` function)

**Changes:**
- Add `try-catch-finally` wrapper around entire function
- Ensure `isExtracting = false` in finally block
- Ensure loading UI is hidden in finally block
- Ensure button is re-enabled in finally block
- Add per-photo error reporting with photo index

**Before:**
```javascript
async function extractReceipts() {
  if (photos.length === 0 || !config) return;
  isExtracting = true;
  document.getElementById('extractBtn').disabled = true;
  document.getElementById('extractionLoading').style.display = 'block';
  // ... extraction loop ...
}
```

**After:**
```javascript
async function extractReceipts() {
  if (photos.length === 0 || !config) return;
  
  isExtracting = true;
  const extractBtn = document.getElementById('extractBtn');
  const loadingDiv = document.getElementById('extractionLoading');
  
  extractBtn.disabled = true;
  loadingDiv.style.display = 'block';
  
  const failedPhotos = [];
  
  try {
    receipts = [];
    for (let i = 0; i < photos.length; i++) {
      // ... extraction logic ...
    }
  } catch (outerError) {
    showPersistentToast('Extraction failed: ' + outerError.message, 'error');
  } finally {
    isExtracting = false;
    loadingDiv.style.display = 'none';
    extractBtn.disabled = false;
    
    if (failedPhotos.length > 0) {
      showPersistentToast(`Failed to extract ${failedPhotos.length} photo(s): ${failedPhotos.join(', ')}`, 'error');
    }
  }
}
```

---

### Sub-Step 2: Add Per-Photo Error Details
**File:** `index.html` (JavaScript - inside extraction loop)

**Changes:**
- Track which specific photos failed
- Include photo index (Photo 1, Photo 2) in error messages
- Continue processing remaining photos after a failure

**Logic:**
```javascript
for (let i = 0; i < photos.length; i++) {
  const photo = photos[i];
  const photoNum = i + 1;
  
  try {
    const extracted = await extractReceiptWithPoe(photo);
    receipts.push({...extracted, photoNum});
  } catch (e) {
    failedPhotos.push(`Photo ${photoNum}: ${e.message.substring(0, 30)}`);
    // Still create entry with empty fields for failed photos
    receipts.push({
      id: 'receipt_' + Date.now() + '_' + i,
      photoId: photo.id,
      photoNum: photoNum,
      originalFilename: photo.file ? photo.file.name : 'receipt.jpg',
      vendor: '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      currency: 'HKD',
      category: 'Uncategorized',
      remarks: 'Extraction failed',
      imageDataUrl: photo.dataUrl
    });
  }
}
```

---

### Sub-Step 3: Add Persistent Toast with X Button
**File:** `index.html`

#### 3a. Update Toast CSS
**Add to style section:**
```css
.toast.persistent {
  padding-right: 40px; /* Make room for X button */
}

.toast-close-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.toast-close-btn:hover {
  opacity: 1;
}
```

#### 3b. Add New Toast Function
**Add JavaScript function:**
```javascript
function showPersistentToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  
  // Clear any existing auto-dismiss timeout
  if (toast.dismissTimeout) {
    clearTimeout(toast.dismissTimeout);
  }
  
  // Remove any existing close button
  const existingCloseBtn = toast.querySelector('.toast-close-btn');
  if (existingCloseBtn) {
    existingCloseBtn.remove();
  }
  
  // Set content
  toast.textContent = message;
  toast.className = 'toast persistent ' + type;
  
  // Add close button for persistent toasts
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => {
    toast.classList.remove('show');
  };
  toast.appendChild(closeBtn);
  
  // Show toast
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
}
```

#### 3c. Update Existing showToast to Use requestAnimationFrame
**Modify existing function:**
```javascript
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  
  // Clear any existing auto-dismiss timeout
  if (toast.dismissTimeout) {
    clearTimeout(toast.dismissTimeout);
  }
  
  // Remove any existing close button (for non-persistent)
  const existingCloseBtn = toast.querySelector('.toast-close-btn');
  if (existingCloseBtn) {
    existingCloseBtn.remove();
  }
  
  toast.textContent = message;
  toast.className = 'toast ' + type;
  
  // Use requestAnimationFrame to ensure DOM update before showing
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Auto-dismiss for non-error types only
  if (type !== 'error') {
    toast.dismissTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}
```

---

### Sub-Step 4: Update Error Calls to Use Persistent Toast
**File:** `index.html`

**Replace error toast calls:**
- `showToast('Error message', 'error')` → `showPersistentToast('Error message', 'error')`

**Locations to update:**
1. Extraction outer error catch
2. Per-photo extraction failures (aggregated)
3. Any other error toasts in the app

---

## Test Cases

| Test | Steps | Expected Result |
|------|-------|----------------|
| TC1 | Upload 3 photos, AI mode, 2nd photo fails | Process completes, review panel shows 3 entries, error toast shows "Failed to extract 1 photo(s): Photo 2: [reason]" |
| TC2 | Upload 1 photo, AI mode, extraction fails | Error toast appears immediately, shows specific error, has X button, doesn't auto-dismiss |
| TC3 | Tap X on error toast | Toast disappears immediately |
| TC4 | Upload photos, manual mode | No AI extraction, entries created with defaults, no errors |
| TC5 | Success message | Auto-dismisses after 3 seconds, no X button |

---

## Files Modified
- `index.html` (CSS and JavaScript)

## No Backend Changes
- All changes are client-side only

## Risk Assessment
- **Low-Medium:** Primarily error handling improvements
- **Risk:** Toast CSS changes may affect layout
- **Mitigation:** Test both persistent and auto-dismiss toasts
