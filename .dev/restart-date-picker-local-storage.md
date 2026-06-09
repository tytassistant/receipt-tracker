# Persist Summary Panel Start Date via localStorage

## Problem
Summary panel's "Start Date" date picker defaults to first of current month every load. User wants the chosen date persisted between sessions so it re-loads automatically next time.

## Change Location
`/home/shared/documents/programs/receipt-tracker/index.html`, **two locations**:

1. **Line ~1593–1597** (`showWelcomePanel()`) — conditional init from localStorage or fallback
2. **Line ~2861** (onChange handler on date picker) — save value to localStorage on change

## Draft Changes

### Change 1: Conditional date init in showWelcomePanel() (lines ~1593-1597)

```js
// Before:
const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

document.getElementById('summaryStartDate').value = formatDateForInput(startOfMonth);
document.getElementById('summaryEndDate').value = formatDateForInput(today);

// After:
const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const savedDate = localStorage.getItem('receipt-tracker-summary-start-date');

// Use saved date if present and valid, else fall back to current default
if (savedDate) {
  document.getElementById('summaryStartDate').value = savedDate;
} else {
  document.getElementById('summaryStartDate').value = formatDateForInput(startOfMonth);
}
document.getElementById('summaryEndDate').value = formatDateForInput(today);
```

### Change 2: Save to localStorage on date picker change (line ~2861)

```js
// Before:
document.getElementById('summaryStartDate').addEventListener('change', () => loadSummaryData());

// After:
document.getElementById('summaryStartDate').addEventListener('change', () => {
  localStorage.setItem('receipt-tracker-summary-start-date', this.value);
  loadSummaryData();
});
```

## Storage Key & Format
- **Key**: `receipt-tracker-summary-start-date`
- **Value**: plain ISO date string (e.g., `2026-06-01`)
- No encryption needed — only a date value
- Native `<input type="date">` validation guarantees valid values from the UI

## Notes
- Only affects summary panel's start date. Review panel gets its range dynamically from summary via `loadReviewData()` which reads directly from `summaryStartDate` at runtime.
- If user manually changes the picker, value is saved on every change (lightweight localStorage write).
- No validation edge cases: date picker only produces valid ISO dates.
