# Receipt Tracker

Track receipts with AI-powered extraction and Google Drive/Sheets storage.

## Features

- **AI Extraction** — Upload receipt photos, LLM extracts: description, amount, currency, date, category, remarks
- **Google Drive** — Images saved to `/receipts/YYYYMMDD/` folder in your Drive
- **Google Sheets** — Records appended to a "receipts" spreadsheet automatically
- **PIN Protection** — Poe API key encrypted with your PIN, stored locally
- **Multi-receipt** — Process multiple receipts in one batch
- **Editable Review** — Correct any AI mistakes before saving

## How It Works

```
Receipt Photo → LLM Extraction → Review & Edit → Google Drive + Sheets
```

1. **Upload** — Select one or more receipt photos
2. **Extract** — AI parses each receipt for: description, total amount, currency, date, category, remarks
3. **Review** — Edit any extracted fields (amount, category, date, etc.)
4. **Save** — Images uploaded to Drive, records written to Sheets

## Setup

See [apps-script/SETUP.md](apps-script/SETUP.md) for full Google Apps Script deployment guide.

### Quick Start

1. Open `index.html` in a browser (or serve via local server)
2. Enter your Poe API key and set a 6-character PIN
3. Deploy the Apps Script (see SETUP.md) and enter the URL + secret token
4. Start tracking receipts

## Google Sheet Columns

| Date | Description | Amount | Currency | Category | Remarks | Image_URL | Created_At |

**Categories:** Food, Transport, Grocery, Shopping, Others

## Files

```
receipt-tracker/
├── index.html              ← Main app (open in browser)
├── apps-script/
│   ├── Code.gs            ← Google Apps Script backend
│   ├── appsscript.json    ← Apps Script manifest
│   └── SETUP.md           ← Deployment guide
├── SPECIFICATION.md        ← Full technical specification
└── README.md              ← This file
```

## Security

- **Poe API key** — AES-GCM encrypted with your PIN, stored in localStorage. Never sent to Google.
- **Secret token** — Protects your Apps Script from unauthorized writes.
- **HTTPS only** — All requests use HTTPS (required by Google Apps Script).

## Categories

AI automatically categorizes receipts into:
- 🍜 **Food** — Restaurants, delivery, groceries
- 🚕 **Transport** — Taxi, MRT, bus, rides
- 🛒 **Grocery** — Supermarket, wet market
- 🛍️ **Shopping** — Clothes, electronics, online shopping
- 📦 **Others** — Anything that doesn't fit above