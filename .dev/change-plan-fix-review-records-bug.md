# Change Plan: Fix "No image file ID found" recurrence bug

## The Bug

When a user dismisses the AI review summary dialog (without leaving the panel or clicking "Confirm & Exit"), global state `reviewRecords` is left pointing to only the previously-selected subset of records. A subsequent "Review with AI" click queries DOM checkboxes for indices larger than any entry in the shrunken array — `reviewRecords[idx]` yields `undefined`, triggering "No image file ID found" immediately.

Root cause: **Line 2124** mutates the global `reviewRecords` in-place, destroying cross-call integrity.

## Root Cause Code (Current — lines 2119-2124)

```js
// Filter to only selected records, preserving DOM index for checkbox mapping
const selectedIndices = [];
document.querySelectorAll('[type="checkbox"].ai-review-select-cb').forEach((cb, idx) => {
  if (cb.checked) selectedIndices.push(idx);
});
reviewRecords = selectedIndices.map(idx => ({ ...reviewRecords[idx], _origIndex: idx }));
```

## Changes (3 lines)

### Change 1 — Line 2119-2124: Replace mutation with new local variable

```diff
   // Filter to only selected records, preserving DOM index for checkbox mapping
   const selectedIndices = [];
   document.querySelectorAll('[type="checkbox"].ai-review-select-cb').forEach((cb, idx) => {
     if (cb.checked) selectedIndices.push(idx);
   });
-  reviewRecords = selectedIndices.map(idx => ({ ...reviewRecords[idx], _origIndex: idx }));
+  const selRefs = selectedIndices.map(si => ({ ...reviewRecords[si], _origIndex: si }));

   const progressDiv = document.getElementById('reviewAiProgress');
```

### Change 2 — Line 2147: Use new local reference in loop bound

```diff
-  for (let i = 0; i < reviewRecords.length; i++) {
+  for (let i = 0; i < selRefs.length; i++) {
     const r = reviewRecords[i];
```

### Change 3 — Line 2157: Update progress text length reference

```diff
-    progressText.textContent = `Verifying record ${i + 1} of ${reviewRecords.length}...`;
+    progressText.textContent = `Verifying record ${i + 1} of ${selRefs.length}...`;
```

## Post-Change Actions (only after approval)
1. Apply all 3 patches (sequential, not simultaneous)
2. Git commit + push to remote branch `main`

## Verification
- Repeat the scenario: review entries → dismiss error dialog without leaving panel → click "Review with AI" again → verify no immediate "No image file ID found" error.
- Verify normal flow still works: select records → "Review with AI" → progress text shows correct totals → failures reported correctly.
