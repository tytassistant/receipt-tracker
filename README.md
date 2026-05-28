# Receipt Tracker — v1.0 (2026-05-28)

AI-powered receipt management using Google Sheets, Google Drive, and Poe AI.

---

## Key App Features

- **AI Receipt Extraction** — photograph receipts, GPT-4o extracts vendor, amount, category automatically
- **Manual Entry** — add receipts without photos, edit before saving
- **Google Sheets + Drive** — all data stored in Google Sheets, images in Drive
- **Edit & Delete** — update or remove existing receipts (UUID-based identification)
- **Summary Dashboard** — spending totals by date range
- **PIN-Protected** — credentials encrypted locally with a 6-character PIN

---

## How to Set Up

### 1. Google Drive Folder

Create a folder named **`receipt-tracker`** in Google Drive root.

To get the Folder ID:
1. Right-click the folder → **Share** → **Copy link**
2. The link looks like: `https://drive.google.com/drive/folders/FOLDER_ID`
3. The **FOLDER_ID** is the long string (e.g. `1eP9NqE9y5xVRNrU5z2V6qB7c4f8k0lM`)

### 2. Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Create a **new project**
3. Copy the contents of `apps-script/Code.gs` into `Code.gs`
4. Rename the default file from `Code.js` to `Code.gs` if needed

### 3. Script Properties

In Apps Script editor → **Project Settings** → **Script Properties**:

| Property | Value |
|----------|-------|
| `SECRET_TOKEN` | Any random string (min 16 chars recommended) — used to authenticate API calls |

### 4. Sheet + Folder Permissions

- The script will automatically create a spreadsheet named **`receipts-database`** in the `receipt-tracker` Drive folder
- Ensure the Apps Script has permission to access Drive and Sheets APIs

### 5. Web App Deployment

1. In Apps Script editor → **Deploy** → **New deployment**
2. Select type: **Web app**
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy** → copy the **Web app URL** (this is your `APPS_SCRIPT_URL`)
5. Note the **Deployment ID** from the URL: `AKfycbyb_rQDbHMxgkpYQ4gUFzBdGqqI-KY23gA8Zb2rghWYSF-7Uzn4vrlTBToOmnCERWI7`

### 6. Frontend Setup

Host `index.html` on any static hosting (GitHub Pages, Netlify, etc.).

In the app's setup screen, enter:
- **Poe API Key** — from poe.com/api
- **Google Apps Script URL** — the web app URL from step 5
- **Secret Token** — the same string you set as `SECRET_TOKEN` in Script Properties

---

## How to Deploy Updates

### Step 1: Push code to Apps Script
```bash
cd apps-script
clasp push --force
```

### Step 2: Update existing deployment
```bash
clasp deploy -i AKfycbyb_rQDbHMxgkpYQ4gUFzBdGqqI-KY23gA8Zb2rghWYSF-7Uzn4vrlTBToOmnCERWI7 -d "Description of changes"
```

This updates the existing deployment — **the web app URL does not change**.

### Frontend (index.html)
Push to GitHub (or your hosting) — no Apps Script deployment needed for frontend-only changes.

---

## How to Get Deployment ID

```bash
clasp deployments
```

Output:
```
Found 2 deployments.
- AKfycbzivzDVf79d84P3mwseLjweelatA7bpYRDnlB_Omrk @HEAD
- AKfycbyb_rQDbHMxgkpYQ4gUFzBdGqqI-KY23gA8Zb2rghWYSF-7Uzn4vrlTBToOmnCERWI7 @26
```

The long string (e.g. `AKfycbyb_rQDbHMxgkpYQ4gUFzBdGqqI-KY23gA8Zb2rghWYSF-7Uzn4vrlTBToOmnCERWI7`) is the **Deployment ID** for `clasp deploy -i`.

---

## Google Sheet Structure

| Column | Field | Notes |
|--------|-------|-------|
| A | Record_no | Auto-incrementing |
| B | Date | YYYY-MM-DD |
| C | Created_at | HKT timestamp |
| D | Modified_at | HKT timestamp |
| E | Description | Vendor/store name |
| F | Amount | Number |
| G | Currency | e.g. HKD, USD |
| H | Category | e.g. Food, Transport |
| I | Remarks | Free text |
| J | Image_name | Timestamped filename |
| K | Image_URL | Google Drive sharing link |
| L | ID | UUID v4 — unique receipt identifier |

---

## Required Script Properties

| Property | Description |
|----------|-------------|
| `SECRET_TOKEN` | Authentication token — must match what the frontend sends |

---

## API Actions

| Action | Purpose |
|--------|---------|
| `queryReceipts` | Fetch receipts by date range |
| `saveReceipts` | Append new receipts to sheet |
| `uploadImage` | Upload image to Drive |
| `updateReceipt` | Update existing receipt by ID |
| `deleteReceipt` | Delete receipt by ID (trashes Drive image) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-05-28 | Initial release with edit/delete features |

---

## Troubleshooting

### "Failed to fetch" in summary panel
- Check that the web app deployment access is set to **Anyone**
- In Apps Script → Deploy → Manage deployments → Edit → Access: **Anyone**

### Images not showing in edit panel
- Ensure the `receipt-tracker` Drive folder sharing is set to **Anyone with the link**
- Images use `drive.google.com/thumbnail?id=FILEID&sz=w800`

### clasp push skips / doesn't sync
- Use `clasp push --force` to force sync
- Then verify with `clasp status`

### Deployment URL changed after deploy
- You're creating a **new deployment** instead of updating
- Use `clasp deploy -i <existingDeploymentId>` with the `-i` flag to update in place