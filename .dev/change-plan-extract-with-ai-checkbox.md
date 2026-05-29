# Change Plan: "Extract with AI" Checkbox Feature

## Overview
Add a checkbox in the capture panel to toggle between AI extraction and manual data entry.

## Requirements

### 1. UI Changes (index.html - Capture Panel)
**Location:** After photo grid, before action buttons
**Add:**
- Checkbox labeled "Extract with AI"
- Default state: **checked/ticked**
- Button label dynamically updates based on checkbox state

### 2. Button Label Logic
| Checkbox State | Button Label |
|---------------|--------------|
| Checked | "Extract with AI" |
| Unchecked | "Enter Details" |

### 3. Workflow Logic

#### Path A: "Extract with AI" (checked)
- **Current behavior preserved**
- Call Poe API for each photo
- Extract amount, date, description, currency, remarks
- Populate review panel with AI-extracted data

#### Path B: "Enter Details" (unchecked)
- **Skip AI extraction**
- Create empty receipt entries directly
- Pre-populate fields:
  - Amount: empty (required validation)
  - Description: empty (required validation)
  - Remarks: empty
  - Currency: "HKD" (default)
  - Date: Today's date (current date)
- Navigate to review panel with empty rows

### 4. Validation Rules
- **Photos required** regardless of checkbox state
- Extract button disabled until photos uploaded
- Cannot proceed without at least one photo

## Implementation Sub-Steps

### Sub-Step 1: Add UI Elements
**File:** index.html
**Action:** Add checkbox and update button structure in capture panel
**Details:**
- Insert checkbox `<input type="checkbox" id="extractAiCheckbox">` with label
- Wrap button in container for layout
- Set initial checkbox state to `checked`

### Sub-Step 2: Add CSS for Checkbox
**File:** index.html (style section)
**Action:** Add checkbox styling
**Details:**
- Style checkbox container
- Ensure proper spacing and alignment
- Dark mode support

### Sub-Step 3: Add Checkbox Event Listener
**File:** index.html (JavaScript)
**Action:** Listen for checkbox change events
**Details:**
- Add event listener on `extractAiCheckbox`
- Toggle button label text on change
- Update button icon if needed

### Sub-Step 4: Modify Extract Button Handler
**File:** index.html (JavaScript)
**Action:** Branch logic based on checkbox state
**Details:**
- Check `extractAiCheckbox.checked` state
- If checked: call existing `extractReceipts()`
- If unchecked: call new `skipAiAndGoToReview()`

### Sub-Step 5: Implement Manual Entry Function
**File:** index.html (JavaScript)
**Action:** Create `skipAiAndGoToReview()` function
**Details:**
```javascript
function skipAiAndGoToReview() {
  // Create empty receipt entry for each photo
  // Set defaults: currency="HKD", date=today, empty amount/description
  // Navigate to review panel (setStep(3))
}
```

### Sub-Step 6: Update Review Panel for Required Fields
**File:** index.html
**Action:** Ensure review panel handles empty/required fields
**Details:**
- Verify amount field validates as required
- Verify description field validates as required
- Test manual entry flow end-to-end

## Test Cases

| Test | Steps | Expected Result |
|------|-------|----------------|
| TC1 | Upload photo, checkbox ticked, click "Extract with AI" | Poe API called, data extracted, review panel populated |
| TC2 | Upload photo, checkbox unticked, click "Enter Details" | Skip API, review panel shows empty rows with HKD/today defaults |
| TC3 | Checkbox ticked, no photos | Button disabled, cannot proceed |
| TC4 | Checkbox unticked, no photos | Button disabled, cannot proceed |
| TC5 | Toggle checkbox multiple times | Button label updates correctly each time |

## Files Modified
- `index.html` (UI, CSS, JavaScript)

## No Backend Changes Required
- Poe API integration already exists
- Review panel already supports manual editing

## Risk Assessment
- **Low Risk:** Mostly UI/UX changes
- **Medium Risk:** Need to ensure validation works for empty manual entries
- **Mitigation:** Test both paths thoroughly
