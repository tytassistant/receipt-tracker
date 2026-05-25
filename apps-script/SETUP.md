# Receipt Tracker – Google Apps Script Setup

## Overview

The app has two parts:
1. **Frontend** (`index.html`) — runs in browser, handles photo upload, LLM extraction, review/edit
2. **Backend** (`apps-script/`) — Google Apps Script, receives data, saves images to Drive and records to Sheets

---

## Step 1: Create the Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **+ New untitled project**
3. Rename the project: `Receipt Tracker Backend`
4. Delete any code in `Code.gs` (replace with the content from `apps-script/Code.gs`)

## Step 2: Add Files

### Code.gs
- Copy the entire contents of `apps-script/Code.gs` into the editor
- **Important:** Replace the placeholder at the top:
  ```javascript
  // Keep this 20+ characters, random string
  const SECRET_TOKEN = "REPLACE_WITH_YOUR_SECRET_TOKEN";
  ```
  Use a random string (at least 20 characters). You'll use the same string in `index.html`.

### appsscript.json
- In the left sidebar, click **+** next to **Files** → **Script**
- Name it `appsscript`
- Paste in the contents of `apps-script/appsscript.json`

## Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to **Select type** → choose **Web app**
3. Fill in:
   - **Description:** `Receipt Tracker v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**
5. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/XXXXX/exec
   ```

## Step 4: Set Up Google Sheet (First Time)

The Apps Script will create the spreadsheet automatically on first run.

But if you want to pre-create it:
1. Go to [sheets.google.com](https://sheets.google.com)
2. Create a new spreadsheet named `receipts`
3. The script will detect it exists and add rows to it

## Step 5: Configure index.html

When you first open `index.html`, you'll be asked to enter:
- **Poe API Key** — your key from [poe.com](https://poe.com/api-key)
- **PIN** — 6 alphanumeric characters (used to encrypt your Poe key locally)
- **Google Apps Script URL** — the URL you copied in Step 3
- **Secret Token** — the random string you set in `Code.gs`

---

## File Structure

```
receipt-tracker/
├── index.html              ← Main app (open this in browser)
├── apps-script/
│   ├── Code.gs            ← Copy this to Google Apps Script
│   └── appsscript.json    ← Copy this to Google Apps Script (as appsscript.json)
└── SETUP.md               ← This file
```

---

## How It Works

### Data Flow
```
[index.html] 
    │
    ├─ 1. Images selected & LLM extracts receipt data
    │
    ├─ 2. User reviews & edits in browser
    │
    ├─ 3. Confirm & Save → POST to Apps Script URL
    │      │
    │      ├─ Images uploaded to: Drive/receipts/YYYYMMDD/
    │      │
    │      └─ Records written to: Sheets ("receipts" spreadsheet)
    │
    └─ 4. Success/error shown in browser
```

### Google Drive Structure
```
My Drive/
└── receipts/
    ├── 20260524/
    │   ├── receipt_20260524_001.jpg
    │   ├── receipt_20260524_002.jpg
    │   └── ...
    └── receipts.xlsx     ← The Google Sheet
```

### Google Sheet Columns
| Date | Description | Amount | Currency | Category | Remarks | Image_URL | Created_At |

---

## Troubleshooting

### "Invalid token" error
- Make sure the `SECRET_TOKEN` in `Code.gs` matches exactly what you entered in `index.html`
- No extra spaces, copy-paste carefully

### "Apps Script URL not found"
- Check the URL in `index.html` settings matches the deployed Web App URL exactly
- The URL must end with `/exec`

### Spreadsheet not found
- Make sure the spreadsheet is named exactly `receipts` (no extra characters)
- Or edit `SPREADSHEET_NAME` in `Code.gs` to match your sheet name

### Images not uploading to Drive
- Check that the Apps Script has Drive API enabled
- Go to Apps Script → Services → add Drive API if not listed

---

## Security Notes

- **Secret Token** — protects your backend from unauthorized writes. Anyone with the URL and token can write to your Drive/Sheet.
- **Poe API Key** — encrypted with your PIN using AES-GCM, stored in localStorage. Never sent to Google.
- **HTTPS** — all requests use HTTPS (Google's requirement for Apps Script Web Apps).