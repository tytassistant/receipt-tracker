# Receipt-Tracker: Detailed Workflow & Function Specification

*Saved: 2026-05-24*

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RECEIPT-TRACKER SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐          ┌─────────────────────────────────┐ │
│  │   BROWSER (Local)    │          │    GOOGLE CLOUD (Server-Side)   │ │
│  │                      │          │                                 │ │
│  │  index.html          │          │  ┌─────────────────────────┐    │ │
│  │  ├── PIN Encryption  │          │  │   Google Apps Script    │    │ │
│  │  ├── Photo Upload    │───────────▶│   (Code.gs)              │    │ │
│  │  ├── LLM Extraction  │  POST    │   ├── doPost()            │    │ │
│  │  └── Review UI       │  (JSON)  │   ├── saveReceipts()      │    │ │
│  │                      │          │   ├── uploadToDrive()     │    │ │
│  │  localStorage:       │          │   └── writeToSheet()      │    │ │
│  │  - Poe API key (enc) │          │                             │    │ │
│  │  - Apps Script URL   │          │  ┌─────────────────────┐  │    │ │
│  │  - Secret token       │          │  │  Google Drive       │  │    │ │
│  │  - Receipt config     │          │  │  /receipts/         │  │    │ │
│  │                      │          │  │     /20260524/      │  │    │ │
│  └──────────────────────┘          │  │       receipt001.jpg│  │    │ │
│                                      │  └─────────────────────┘  │    │ │
│                                      │  ┌─────────────────────┐  │    │ │
│                                      │  │  Google Sheets      │  │    │ │
│  ┌──────────────────────┐            │  │  "receipts" tab   │  │    │ │
│  │   POE API (Cloud)    │            │  │  Date|Desc|Amount │  │    │ │
│  │   ├── GPT-5.2        │◄───────────┘  └─────────────────────┘  │    │ │
│  │   └── OCR/Extraction │   (LLM Analysis)                      │    │ │
│  └──────────────────────┘                                          │    │ │
│                                                                      │    │ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DETAILED WORKFLOW (Step-by-Step)

### Phase 1: Initial Setup (First Run)
| Step | User Action | System Response | Data Storage |
|------|-------------|-----------------|--------------|
| 1.1 | Open index.html | Check localStorage for saved config | Browser localStorage |
| 1.2 | (If no config) | Show config panel: | |
| | Enter Poe API key | Validate format | Encrypted with PIN |
| | Set 6-char PIN | Validate alphanumeric | Used for encryption |
| | Enter Apps Script URL | Save to localStorage | `receipt_tracker_config` |
| | Enter secret token | Save to localStorage | `receipt_tracker_token` |
| 1.3 | Click "Save & Continue" | Encrypt Poe key, save all settings | localStorage |

### Phase 2: Capture Receipts
| Step | User Action | System Response | Technical Details |
|------|-------------|-----------------|-------------------|
| 2.1 | Click "Add Receipts" | Show multi-file picker | `<input type="file" multiple>` |
| 2.2 | Select 1-N photos | Generate thumbnails | FileReader API, compress |
| 2.3 | (Optional) Enter text note | Append to prompt context | Smart text input |
| 2.4 | Click "Extract" | Validate: API key? Photos? | Decrypt Poe key from PIN |
| 2.5 | | Show "Extracting..." spinner | DOM manipulation |
| 2.6 | | For each image: | |
| | | → Convert to base64 | canvas.toDataURL() |
| | | → Build LLM prompt | Include extraction rules |
| | | → POST to Poe API | fetch() to api.poe.com |
| 2.7 | | Receive JSON response | Parse: description, amount, date, remarks |
| 2.8 | | Show Review Panel | Render table with extracted data |

### Phase 3: Review & Edit
| Step | User Action | System Response | Data Structure |
|------|-------------|-----------------|----------------|
| 3.1 | Review extracted data | Display table: | Array of receipt objects |
| | | - Thumbnail (click to enlarge) | `{ id, imageDataUrl,` |
| | | - Description (editable) | `description, amount,` |
| | | - Amount (editable) | `currency, date, remarks }` |
| | | - Currency dropdown (default: HKD) | |
| | | - Date picker (default: today HKT) | |
| | | - Remarks (editable, shows breakdown) | |
| 3.2 | Edit any field | Validate amount is numeric | Real-time validation |
| 3.3 | Click "+" to add manual row | Insert blank receipt entry | User fills all fields |
| 3.4 | Click "×" to delete | Remove from array | Update UI |
| 3.5 | Click "Confirm & Save" | Phase 4 begins | |

### Phase 4: Save to Google Drive/Sheets
| Step | System Action | API Calls | Error Handling |
|------|---------------|-----------|----------------|
| 4.1 | Validate all receipts | Check required fields | Show inline errors |
| 4.2 | Get today's HKT date | `new Date().toLocaleString('en-HK')` | |
| 4.3 | For each receipt image: | | |
| | → Generate unique filename | `receipt_${timestamp}_${index}.jpg` | |
| | → POST to Apps Script | `fetch(APPS_SCRIPT_URL, {` | If fail, show retry |
| | | `method: 'POST',` | |
| | | `body: JSON.stringify({` | |
| | | `token: SECRET,` | |
| | | `action: 'uploadImage',` | |
| | | `filename: '...',` | |
| | | `imageBase64: dataUrl,` | |
| | | `folderDate: '20260524'` | |
| | | `})` | |
| 4.4 | Apps Script processes: | | |
| | → Verify token | `if (data.token !== SECRET_TOKEN)` | Return 403 error |
| | → Create folder if needed | `DriveApp.createFolder()` | |
| | → Save image to Drive | `folder.createFile(blob)` | |
| | → Return file URL | `file.getUrl()` | |
| 4.5 | Build receipt records | Include Drive URL for each | |
| 4.6 | POST batch to Apps Script | `action: 'saveReceipts'` | |
| 4.7 | Apps Script writes to Sheet | `SpreadsheetApp.openById()` | Create sheet if missing |
| | → Append rows | `sheet.appendRow([...])` | |
| | Columns: | Date, Description, Amount, Currency, Remarks, Image_URL, Timestamp | |
| 4.8 | Show success message | "N receipts saved to Google Drive" | |
| 4.9 | Clear form / Offer "New Scan" | Reset to Phase 2 | |

---

## 3. KEY FUNCTIONS TO BUILD

### HTML/Frontend Functions

#### A. Authentication & Config
```javascript
// Configuration Management
function initConfigState()           // Check if first run
function showConfigPanel()           // Display setup UI
function saveConfigSettings()        // Save URL, token, Poe key
function validatePoeKeyFormat(key) // Basic format check
function deriveKeyFromPIN(pin)       // For Poe key encryption
function encryptPoeKey(key, pin)     // AES-GCM encryption
function decryptPoeKey(pin)          // Decrypt from localStorage
```

#### B. Photo Capture
```javascript
// Multi-Image Handling
function initPhotoUpload()           // Setup file input (multiple)
function handleFileSelect(files)     // Process multiple files
function compressImage(file, maxSize)// Resize before storage
function generateThumbnail(file)     // Create preview
function removeImage(index)          // Delete from selection
function reorderImages(from, to)     // Drag-drop reorder
```

#### C. LLM Extraction
```javascript
// AI Processing
async function extractReceipts(images) // Main extraction loop
async function callPoeAPI(base64Image, textNote) // Single image
function buildExtractionPrompt()     // System + user prompt
function parseReceiptResponse(content) // JSON → object
function validateExtractedData(data) // Ensure 4 fields present
function normalizeAmount(amount)     // Parse "HK$ 123.45" → 123.45
function normalizeDate(dateStr)      // Parse various formats → YYYY-MM-DD
```

#### D. Review UI
```javascript
// Data Editing Interface
function renderReviewTable(receipts) // Build HTML table
function createReceiptRow(receipt, index) // Single row HTML
function updateReceiptField(index, field, value) // Edit handler
function addManualReceiptRow()       // Add empty row
function deleteReceiptRow(index)     // Remove row
function updateCurrency(row, currency) // Change currency
function openDatePicker(index)       // Native date input
function enlargeImage(index)         // Lightbox viewer
```

#### E. Google Apps Script Integration
```javascript
// Backend Communication
async function saveToGoogle(receipts) // Orchestrate save
async function uploadImageToDrive(imageBase64, filename, folderDate) // Single image
async function batchSaveReceipts(receiptRecords) // Write to Sheet
function buildAppsScriptPayload(action, data) // Request formatter
function handleAppsScriptError(response) // Error parsing
```

### Google Apps Script Functions (Code.gs)

#### A. Main Entry Point
```javascript
function doPost(e)                   // HTTP POST handler
function verifyToken(data)           // Check secret token
function handleAction(action, data)  // Route to handler
```

#### B. Google Drive Operations
```javascript
function uploadImage(filename, base64Data, folderDate)
function getOrCreateFolder(path)     // /receipts/YYYYMMDD
function createFolderIfNotExists(parent, name)
function saveBase64ToDrive(folder, filename, base64)
```

#### C. Google Sheets Operations
```javascript
function getOrCreateSpreadsheet(name)
function getOrCreateSheet(spreadsheet, sheetName)
function appendReceiptRow(sheet, receiptData)
function formatReceiptRow(receipt)   // Array for appendRow
```

#### D. Utility Functions
```javascript
function base64ToBlob(base64, mimeType)
function generateTimestamp()         // ISO format
function logError(error)             // Apps Script logging
```

---

## 4. DATA STRUCTURES

### Receipt Object (Frontend)
```javascript
{
  id: "receipt-1716514567890-0",      // Unique ID
  imageDataUrl: "data:image/jpeg;base64,...", // Full image
  thumbnailUrl: "data:image/jpeg;base64,...", // Compressed
  description: "Dinner at Restaurant ABC",
  amount: 456.78,
  currency: "HKD",                      // Default, editable
  date: "2026-05-24",                 // ISO format
  remarks: "2x Set dinner $228.39 each",
  driveUrl: null,                      // Filled after upload
  status: "pending" | "uploaded" | "saved"
}
```

### Apps Script POST Payloads

**Upload Image:**
```javascript
{
  token: "my-secret-token",
  action: "uploadImage",
  filename: "receipt_20260524_001.jpg",
  imageBase64: "data:image/jpeg;base64,/9j/4AAQ...",
  folderDate: "20260524"
}
```

**Save Receipts:**
```javascript
{
  token: "my-secret-token",
  action: "saveReceipts",
  receipts: [
    {
      date: "2026-05-24",
      description: "Dinner at Restaurant ABC",
      amount: 456.78,
      currency: "HKD",
      remarks: "2x Set dinner",
      imageUrl: "https://drive.google.com/..."
    }
  ]
}
```

### Google Sheet Columns
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Date | Description | Amount | Currency | Remarks | Image_URL | Created_At |
| 2026-05-24 | Dinner at ABC | 456.78 | HKD | 2x Set dinner | drive link | ISO timestamp |

---

## 5. SECURITY CONSIDERATIONS

| Risk | Mitigation |
|------|------------|
| **Apps Script URL exposed** | LocalStorage only, not in code |
| **Secret token leaked** | LocalStorage + hardcoded in Apps Script |
| **Poe API key stolen** | Encrypted with PIN, never stored plain |
| **Images intercepted** | HTTPS only (Google/AppScript) |
| **Unauthorized writes** | Token validation on every request |
| **Token brute-force** | Use 20+ char random string |

---

## 6. ERROR HANDLING STRATEGY

| Scenario | User Feedback | Recovery |
|----------|---------------|----------|
| Poe API rate limit | "Too many requests, wait 60s" | Auto-retry with backoff |
| Image too large | "Image > 5MB, compressing..." | Auto-compress |
| Apps Script 403 | "Invalid token, check config" | Show config panel |
| Drive full | "Storage full, clean Drive" | Manual user action |
| Network offline | "No connection, retry?" | Retry button |
| LLM parse error | "Couldn't read receipt, edit manually" | Show blank row |

---

## 7. FILES TO CREATE

```
receipt-tracker/
├── index.html              # Main app (single file)
├── apps-script/
│   ├── Code.gs             # Main server code
│   ├── appsscript.json     # Manifest
│   └── SETUP.md            # Deployment instructions
├── .gitignore              # Ignore config files
└── README.md               # User guide
```

---

## 8. QUESTIONS BEFORE PROCEEDING

1. **Sheet naming**: Fixed name "receipts" or user-configurable?
2. **Duplicate detection**: Check if same receipt uploaded before?
3. **Offline mode**: Queue saves if offline, sync when back?
4. **Multi-currency conversion**: Store exchange rates or just raw values?
5. **Receipt categories/tags**: Add "Food", "Transport", "Shopping" tags?
6. **Search/Filter in review panel**: Filter by date, amount range?

**Confirm these details and I'll start building.**

---

*Document saved to: /home/shared/documents/receipt-tracker/SPECIFICATION.md*
