# Change Plan: AI Review Error Dialog

## Goal
Replace the generic bottom-of-review toast with a structured, lightweight error dialog (shown only when failures exist) or keep the success toast when everything passes. Improves visibility into exactly *why* records failed during `reviewWithAI()`.

---

## Design Decisions
1. **Dialog, not alert:** Lightweight `<dialog>` overlay matching app layout. Light background for readability, scrollable (`max-height` + `overflow-y: auto`).
2. **No toast if failures exist:** The dialog replaces the error toast entirely in error cases. Keeps existing non-error success toast if nothing fails.
3. **Three explicit categories** (not lumped into one "errors" count):
   - Category A: POE found a figure but it mismatched (counted as errors, box unchecked)
   - Category B: POE could not extract any usable figure (no clear total)
   - Category C: Other types of error (connection, API, timeout, JSON parse, etc.) — classified by programmatic detection.

---

## Step-by-Step Implementation Plan

### Step 1: Add failure tracking arrays to `reviewWithAI()`

**Where:** Inside `reviewWithAI()`, just after existing variables (around line ~1940)

**Before (current):**
```js
  let verified = 0;
  let errors = 0;
```

**After (new):**
```js
  let verified = 0;
  
  // Categorize failures for the dialog summary
  const failureCategoryA = []; // POE found figure but amount mismatch
  const failureCategoryB = []; // POE could not extract any useful figure
  const failureCategoryC = []; // Other errors (connection, API, timeout, etc.)
```

---

### Step 2: Categorize failures inside the for-loop

**A. On POE response ok but amount mismatch (~line ~2006):**
POE found a figure, but `Math.abs(extractedTotal - recordAmount) >= tolerance`.
- Do NOT check the box (per your instruction)
- Count as error/failure
```js
        } else {
          // Mismatched figure
          failureCategoryA.push({
            index: i,
            receiptInfo: r.description || `Record #${i + 1}`,
            poeResult: extractedTotal,
            expectedAmount: recordAmount
          });
          
          console.warn(`[AI Review] ⚠️ Record ${i + 1}: Amount mismatched (POE=${extractedTotal}, Expected=${recordAmount})`);
        }
```

**B. On POE response ok but NO figure found / weird JSON (~line ~2010):**
POE returned text, but regex couldn't find `{ "total": NNN.NN }`.
- Category B: Could not extract usable figure
```js
      } else {
        failureCategoryB.push({
          index: i,
          receiptInfo: r.description || `Record #${i + 1}`,
          reason: 'No clear total extractable'
        });
        console.warn(`[AI Review] ⚠️ Record ${i + 1}: POE returned no figure`);
      }
```

**C. On actual errors (catch block ~line ~2012):**
Network timeouts, HTTP non-OK responses, JSON parse failures, fetch aborts. Classified programmatically instead of generic "Unknown":
```js
    } catch (e) {
      let errorType = 'Connection/Network Error';
      
      // Detect specific error causes
      if (e.name === 'AbortError') {
        errorType = 'Request Timeout / Abort';
      } else if (e.message && e.message.includes('status code')) {
        // Extract status from custom parse or catch response.status > 
        const statusMatch = e.message.match(/status code \#(\d+)/);
        if (statusMatch) errorType = `API Error (HTTP ${statusMatch[1]})`;
      } else {
        errorType = 'Connection/Network Error';
      }
      
      failureCategoryC.push({
        index: i,
        receiptInfo: r.description || `Record #${i + 1}`,
        reason: `${errorType}: ${e.message || String(e)}`
      });
      console.error(`[AI Review] ❌ Record ${i + 1}: ${errorType}`);
    }
```

---

### Step 3: Build the summary text & show dialog / success toast

**Where:** Just after the for-loop ends (right before line ~2019 where progressDiv hides)

**New code added here:**
```js
const totalFailures = failureCategoryA.length + failureCategoryB.length + failureCategoryC.length;

if (totalFailures > 0) {
  const lines = ['AI REVIEW SUMMARY', '']; // Header
  
  // Category A header & list
  if (failureCategoryA.length > 0) {
    lines.push(`═══ AMOUNT MISMATCHED WITH POE EXTRACTION (${failureCategoryA.length}) ═══`);
    failureCategoryA.forEach(f => 
      lines.push(`  - ${f.receiptInfo}: POE found ${f.poeResult}, receipt showed ${f.expectedAmount}`)
    );
    lines.push(''); // blank separator
  }
  
  // Category B header & list
  if (failureCategoryB.length > 0) {
    lines.push(`═══ COULD NOT EXTRACT FIGURE (${failureCategoryB.length}) ═══`);
    failureCategoryB.forEach(f => 
      lines.push(`  - ${f.receiptInfo}: ${f.reason}`)
    );
    lines.push(''); // blank separator
  }
  
  // Category C header & list
  if (failureCategoryC.length > 0) {
    lines.push(`═══ OTHER ERRORS (${failureCategoryC.length}) ═══`);
    failureCategoryC.forEach(f => 
      lines.push(`  - ${f.receiptInfo}: ${f.reason}`)
    );
    lines.push(''); // blank separator
  }
  
  // Append status line exactly as requested:
  // "Verified: X | Figure Mismatch: Y | LLM Returns NO Figure: Z | Other Error: N"
  lines.push(`Verified: ${verified} | Figure Mismatch: ${failureCategoryA.length} | LLM Returns NO Figure: ${failureCategoryB.length} | Other Error: ${failureCategoryC.length}`);
  
  // Show the dialog with joined text (see Step 4)
  showAiReviewErrorDialog(lines.join('\n'));
  
} else {
  // No errors at all — keep existing behavior: success toast
  showToast('AI review complete. All records verified.', 'success');
}
```

---

### Step 4: Show the lightweight dialog overlay (when failures exist)

**Where:** New helper function in global scope or near init block

**Action:** Create/toggle a `<dialog>` element. Light background, scrollable summary text in a selectable `<pre>`. Two bottom buttons: **"Copy"** and **"Okay"**.

**Dialog HTML injected into DOM:**
```html
<div id="aiReviewErrorOverlay" class="ai-review-error-overlay">
  <div class="ai-review-dialog-box">
    <h3>AI Review — Some Records Failed</h3>
    <pre id="reviewFailureSummaryText" style="max-height:400px; overflow-y:auto;"></pre>
    <div class="dialog-buttons">
      <button id="copyBtn">Copy</button>
      <button onclick="closeAiReviewDialog()">Okay</button>
    </div>
  </div>
</div>
```

**"Copy" button action:** Copies `<pre id="reviewFailureSummaryText">` text content to clipboard via `navigator.clipboard.writeText()`. Auto-blink feedback or brief "Copied ✓" on the button.

---

### Step 5: Add dialog styles (CSS section)

**Where:** In existing `<style>` block (~around line 730)

**New CSS rules:**
```css
/* AI review error dialog overlay */
.ai-review-error-overlay {
  display: none;
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 9999;
  align-items: center; justify-content: center;
}
.ai-review-dialog-box {
  background: #ffffff; /* light background — readable */
  border-radius: var(--radius);
  padding: 24px 28px 20px;
  min-width: 500px; max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.ai-review-dialog-box h3 {
  margin: 0 0 12px 0;
  font-size: 16px; color: #1a1a1a;
}
/* pre inside scrollable dialog - inherit spacing but fix monospace */
.ai-review-dialog-box pre {
  margin: 8px 0; padding: 12px; border-radius: 4px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 13px; line-height: 1.5; color: #333; white-space: pre-wrap; word-break: break-word;
}
.ai-review-dialog-box .dialog-buttons {
  display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px;
}
.ai-review-dialog-box .dialog-buttons button {
  padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; border: 1px solid #ddd; background: #f9f9f9; color: #222; transition: all 0.15s ease;
}
.ai-review-dialog-box .dialog-buttons button:hover {
  background: #eee;
}
```

---

## Summary of Files and Sections to Modify

| File | Section / Lines | Change Type |
|------|----------------|-------------|
| `index.html` | Function `reviewWithAI()` (~lines 1930–2025) | (1) Add failure category arrays<br>(2) Replace error counting with categorized push logic<br>(3) Replace final toast logic with dialog / success path using exact requested summary format |
| `index.html` | `<style>` block (~around line 730) | New CSS for dark overlay + light dialog box + scrollable monospace `<pre>` |
| `index.html` | Global scope (end of function defs or init block) | Add helpers: `showAiReviewErrorDialog(text)`, `closeAiReviewDialog()`, attach `copyBtn` listener |

---

## Edge Cases / Logic Clarified
1. **Category A behavior:** POE finds a figure but mismatch -> checkbox stays unchecked, counted as error/failure. ✅ Confirmed by user.
2. **Error typing for Category C:** No longer generic "Unknown". Differentiates via `e.name`, network/HTTP status matching, and custom parsing of caught errors to classify into `Request Timeout / Abort`, `API Error (HTTP status)`, or `Connection/Network Error`. ✅ Confirmed by user logic expectation.
3. **Copy confirmation:** Yes, copy button copies the `<pre>` block text via `navigator.clipboard.writeText()`. Brief "Copied ✓" feedback on button press. ✅ Confirmed by user.
4. **Success path:** If `totalFailures === 0`, keep existing non-error toast (`showToast('... verified', 'success')`). No dialog needed. ✅ Confirmed by user.
