# Change Plan: AI Review Selection + Structured Error Dialog

## Goal
Add "Select for AI Review" per-record checkboxes plus a "Select All" toggle in the review panel, so only selected records go through the AI review loop. Replace the generic error toast with a structured, lightweight failure summary overlay (shown only on failures).

---

## PART A: Selection UI

### Select All button
- Position: **same line as, left of**, the "Review with AI" button
- Label: **"Select All"** (exact text)
- Style: matches existing review-style checkbox ("Reviewed")

### Per-card checkboxes
- Each entry card gets a new checkbox at the bottom
- Label: **"Select for AI Review"** (exact text)

### Selection filtering
- Only records with "Select for AI Review" checked participate in the review
- If user clicks "Review with AI" with **0 selected**:
  - Show toast: `"Please select at least one record for AI review"` — error style
  - Toast must require manual close (X button)
  - Review panel stays as-is, no refresh

### Post-review reset
- After review completes (regardless of success or failure), all "Select for AI Review" boxes auto-deselect to clean state

---

## PART B: Structured Error Dialog

### Failure Categories

| Category | Trigger | Checkbox behavior |
|----------|---------|------------------|
| A | POE extracts a figure but it mismatches within tolerance | Stays **unchecked** |
| B | POE returns no usable figure (null, malformed JSON, no clear total) | N/A |
| C | Classified: Network Error, Timeout, API Error (HTTP status), etc. | N/A |

### Summary Line Format
**Verified: X \| Figure Mismatch: Y \| LLM Returns NO Figure: Z \| Other Error: N**

### Light Scrollable Overlay
- White background for readability vs dark theme
- Monospace font in body
- Scrollable via `overflow-y: auto` to handle many entries
- Header with title "AI Review Summary"
- Footer with two buttons: **Copy** (clipboard) and **Okay** (manual close)

---

## Implementation Order for Combined Change Plan

1. Add Flex-row wrapper HTML around "Review with AI" button, placing `Select All` left of it
2. Insert per-card checkbox into `renderReviewCards()` at card bottom
3. Add JS toggle/filter helpers (`toggleAll`, `getSelectedIndices`, `deselectAll`)
4. Intercept `clickReviewWithAI()` — validate selection before loop
5. Post-loop: deselect all review checkboxes
6. Implement structured error dialog (CSS + HTML overlay + show/copy/close functions)

## Verification Steps

1. Confirm "Select All" appears on same line as Review button, left of it
2. Toggling "Select All" synchronizes all per-card checkboxes
3. With selected records → only those go through POE
4. With NONE selected → error toast (manual X close), panel unmodified
5. Post-review: all select boxes auto-clear
