# Change Plan: AI Review Error Logging

## Goal
Improve visibility into the `reviewWithAI()` function so failures can be diagnosed (which step failed, and why) without adding timeouts or cancel buttons.

---

## Gap Analysis
Current `reviewWithAI()` flow hides its internals behind a single generic toast at the end (`✅ 3 verified, ⚠️ 2 failed`). Inside the loop:
- `imageUrlToDataUrl()` failures log only `'Could not fetch image: ' + r.imageUrl` — doesn't show *which* record number.
- Poe API errors log `console.error('AI review error record ' + i + ':', e)` — no context on whether it was network, HTTP 4xx/5xx, or invalid JSON.
- Successful matches leave no trace in the console.
- Failed parsing (no clear total) is silently skipped with no warning.

There is no step-by-step progression log to tell you exactly when the process stuck or failed.

---

## Proposed Changes

### 1. Add structured step logging inside `reviewWithAI()` (index.html ~line 1930–2020)

**a. Before image fetch — show which record is being processed:**
Insert just before line 1961 (`const imageDataUrl = await imageUrlToDataUrl(r.imageUrl);`):
```js
    console.log(`[AI Review] Processing record ${i + 1}/${reviewRecords.length}: fetching image...`);
```

**b. On image fetch failure — include the problem clearly:**
Change line 1963 from:
```js
      console.error('Could not fetch image: ' + r.imageUrl);
```
To:
```js
      console.error(`[AI Review] ❌ Record ${i + 1}: image fetch failed`);
```

**c. Before Poe API call — show model being used:**
Insert just before line 1972 (`try {`):
```js
    console.log(`[AI Review] Record ${i + 1}: sending to Poe (${model})...`);
```

**d. After successful Poe response — confirm parsing stage (optional, helpful for long-running):**
Insert just before line 1997 (`const data = await response.json();`):
```js
      console.log(`[AI Review] Record ${i + 1}: Poe response received, parsing...`);
```

**e. On successful match — confirm the verification:**
Change the `verified++` block (line ~2008) from:
```js
          verified++;
```
To:
```js
          verified++;
          console.log(`[AI Review] ✅ Record ${i + 1}: verified (${extractedTotal} ≈ ${recordAmount})`);
```

**f. On no-parse warning — log when Poe can't extract a clear total:**
Add after the `if (amountMatch ...)` block closes (before the final `}` of the catch):
```js
      } else {
        console.warn(`[AI Review] ⚠️ Record ${i + 1}: Poe returned no clear total`);
      }
```

**g. On error — include the actual error message:**
Change line 2012 from:
```css
      console.error('AI review error record ' + i + ':', e);
```
To:
```js
      console.error(`[AI Review] ❌ Record ${i + 1}: Poe API error: ${e.message || String(e)}`);
```

---

### 2. Track failures for detailed final summary (index.html ~line 1942)

The current final toast at lines 2019–2020 only counts verified/failed. Adding a failure breakdown helps diagnose patterns:

**Track failures alongside the error counter:**
Replace line 1942 (`let errors = 0;`) with:
```js
  let verified = 0;
  let errors = 0;
  const failures = []; // tracks each failure for post-loop summary
```

Push to `failures` in the two error paths (image fail ~line 1965, Poe error ~after line 2013):
```js
      // In the image fetch failure block:
      failures.push({ index: i, step: 'image', error: 'Could not fetch image' });
      
      // In the Poe error catch block (after console.error):
      failures.push({ index: i, step: 'poe', error: e.message || String(e) });
```

Add failure summary to the final log (just before `progressDiv.style.display = 'none';` on line 2019):
```js
  if (failures.length > 0) {
    console.warn(`[AI Review] Final: ${verified} verified, ${errors} failed.`);
    failures.forEach(f => console.warn(`  - Record ${f.index + 1}: failed at step "${f.step}"`));
    // For image fetch, add the receipt ID for correlation:
    failures.filter(f => f.step === 'image').forEach(f => 
      console.warn(`    (receipt ID: ${reviewRecords[f.index].id})`)
    );
  }
```

---

## File Changes Summary
| File | Lines Affected | Type |
|------|---------------|------|
| `index.html` | ~1930–2025 (`reviewWithAI` function) | Inline console.log additions + failure tracking array |

## Notes / Considerations
- No new dependencies or async complexity; all changes are synchronous `console.log`/`console.error`.
- `[AI Review]` prefix allows easy filtering in browser DevTools (Ctrl+Shift+F → search `[AI Review]`).
- Image fetch failures include the receipt object so you can correlate to the specific row.
- Poe errors include just the message text to avoid stack-trace spam in the final summary, while still being available in the `console.error` line above it.
