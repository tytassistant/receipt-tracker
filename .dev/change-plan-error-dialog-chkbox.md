# Change Plan: Error dialog button colors + checkbox position

## 1. Swap Copy/Ak button colors in error dialog

**Target:** Lines 1362-1363 (HTML template, static markup)

**Before:**
```html
<button class="ai-error-btn primary" id="aiCopyLogBtn" onclick="copyAiReviewLog()">Copy</button>
<button class="ai-error-btn secondary" onclick="closeAiReviewErrorDialog()">Okay</button>
```

**After:**
```html
<button class="ai-error-btn secondary" id="aiCopyLogBtn" onclick="copyAiReviewLog()">Copy</button>
<button class="ai-error-btn primary" onclick="closeAiReviewErrorDialog()">Okay</button>
```

## 2. Move "Select for AI Review" checkbox inside card, alongside "Reviewed" + \| separator

**Target:** Lines 2038-2045 in `renderReviewCards()` (inline HTML template)

**Before (card footer):**
```html
      </div>
    </div>
  </div>
</div>
<div style="text-align:center; padding-top:12px; border-top:1px solid var(--border); margin-top:8px;">
  <label style="display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; font-size:13px; color:var(--text-muted); user-select:none;" class="select-for-ai-review">
    <input type="checkbox" class="ai-review-select-cb">
    Select for AI Review
  </label>
</div>
`
```

**After (card footer integrated):**
```html
      </div>
      <!-- Footer row: Reviewed | Select for AI Review -->
      <div style="display:flex; gap:8px; justify-content:center; align-items:center; padding-top:8px; margin-top:8px; border-top:1px solid var(--border);">
        <span style="color:var(--text-muted); font-size:13px;">|</span>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; color:var(--text-muted); user-select:none;">
          <input type="checkbox" class="ai-review-select-cb">
          Select for AI Review
        </label>
      </div>
    `
```

## Post-Change Actions (only after approval)
1. Apply patch A (button color swap, lines 1362-1363 — two attribute changes)
2. Apply patch B (card template rewrite, lines ~2038-2045)
3. Git commit + push to origin/main

## Verification
- Error dialog: Copy button should now appear grey/secondary, Okay button blue/primary
- Review panel: Select for AI Review checkbox inside card footer on same line as Reviewed checkbox with | separator between them
