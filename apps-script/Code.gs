// ============================================================
// Receipt Tracker – Google Apps Script Backend (Code.gs)
// ============================================================
// SETUP: Replace with your secret token (same one used in index.html)
// Keep this 20+ characters, random string
const SECRET_TOKEN = "8D6@6*P$WctFMnw8jHEr";

// Folder name in Google Drive where receipts are stored
const RECEIPTS_FOLDER = "receipts";

// Spreadsheet name in Google Drive
const SPREADSHEET_NAME = "receipts";

// Column headers for the Sheet
const COLUMNS = ["Date", "Description", "Amount", "Currency", "Category", "Remarks", "Image_URL", "Created_At"];

// ============================================================
// Main entry point – handles all POST requests
// ============================================================
function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  // Verify secret token
  if (!verifyToken(payload.token)) {
    return jsonResponse(403, { error: "Invalid or missing token" });
  }

  var action = payload.action;
  var data = payload.data || {};

  try {
    if (action === "uploadImage") {
      return handleUploadImage(data);
    } else if (action === "saveReceipts") {
      return handleSaveReceipts(data);
    } else if (action === "getFolder") {
      return handleGetFolder(data);
    } else {
      return jsonResponse(400, { error: "Unknown action: " + action });
    }
  } catch (err) {
    logError("Action " + action + " failed: " + err.message + "\n" + err.stack);
    return jsonResponse(500, { error: err.message });
  }
}

// ============================================================
// Token verification
// ============================================================
function verifyToken(token) {
  return token && token === SECRET_TOKEN;
}

// ============================================================
// Action: uploadImage
// Saves a base64 image to Drive/receipts/YYYYMMDD/
// Returns the file URL
// ============================================================
function handleUploadImage(data) {
  var filename = data.filename;
  var base64Data = data.imageBase64;
  var folderDate = data.folderDate; // YYYYMMDD format

  if (!filename || !base64Data || !folderDate) {
    return jsonResponse(400, { error: "Missing filename, imageBase64, or folderDate" });
  }

  // Remove data URL prefix if present
  var cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  var blob = Utilities.base64Decode(cleanBase64);
  var mimeType = detectMimeType(filename, cleanBase64);

  // Get or create the date folder inside /receipts/
  var folder = getOrCreateReceiptFolder(folderDate);

  // Create and save the file
  var file = folder.createFile(Utilities.newBlob(blob, mimeType, filename));

  return jsonResponse(200, {
    success: true,
    filename: filename,
    fileUrl: file.getUrl(),
    fileId: file.getId(),
    folderUrl: folder.getUrl()
  });
}

// ============================================================
// Action: saveReceipts
// Appends one row per receipt to the Google Sheet
// ============================================================
function handleSaveReceipts(data) {
  var receipts = data.receipts;

  if (!receipts || !Array.isArray(receipts) || receipts.length === 0) {
    return jsonResponse(400, { error: "receipts array is required" });
  }

  var sheet = getOrCreateSheet();
  var timestamp = new Date().toISOString();
  var savedCount = 0;

  for (var i = 0; i < receipts.length; i++) {
    var r = receipts[i];
    var row = [
      r.date || "",
      r.description || "",
      parseFloat(r.amount) || 0,
      r.currency || "HKD",
      r.category || "Others",
      r.remarks || "",
      r.imageUrl || "",
      timestamp
    ];
    sheet.appendRow(row);
    savedCount++;
  }

  return jsonResponse(200, {
    success: true,
    saved: savedCount,
    sheetUrl: sheet.getParent().getUrl()
  });
}

// ============================================================
// Action: getFolder
// Returns the receipts folder URL (creates it if missing)
// ============================================================
function handleGetFolder(data) {
  var folderDate = data.folderDate || formatDate(new Date());
  var folder = getOrCreateReceiptFolder(folderDate);
  return jsonResponse(200, {
    folderUrl: folder.getUrl(),
    folderId: folder.getId()
  });
}

// ============================================================
// Drive folder management
// ============================================================

// Get or create the root /receipts/ folder
function getOrCreateRootFolder() {
  var folders = DriveApp.getFoldersByName(RECEIPTS_FOLDER);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(RECEIPTS_FOLDER);
}

// Get or create /receipts/YYYYMMDD/ folder
function getOrCreateReceiptFolder(folderDate) {
  var root = getOrCreateRootFolder();
  var subfolders = root.getFoldersByName(folderDate);
  if (subfolders.hasNext()) {
    return subfolders.next();
  }
  return root.createFolder(folderDate);
}

// ============================================================
// Sheet management
// ============================================================

// Get or create the receipts spreadsheet and sheet
function getOrCreateSheet() {
  var root = getOrCreateRootFolder();
  var files = root.getFilesByName(SPREADSHEET_NAME + ".xlsx");

  var spreadsheet;
  if (files.hasNext()) {
    var file = files.next();
    spreadsheet = SpreadsheetApp.openById(file.getId());
  } else {
    // Create new spreadsheet in the receipts root folder
    var ssId = SpreadsheetApp.create(SPREADSHEET_NAME).getId();
    // Move it to the receipts folder (SpreadsheetApp.create puts it in root)
    // We'll work with it from here
    spreadsheet = SpreadsheetApp.openById(ssId);
  }

  var sheet = spreadsheet.getSheetByName("Sheet1") || spreadsheet.insertSheet("Sheet1");

  // Add headers if the sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    // Style header row
    sheet.getRange(1, 1, 1, COLUMNS.length)
      .setBackground("#f8f9fa")
      .setFontWeight("bold");
    // Freeze header row
    spreadsheet.setFrozenRows(1);
  }

  return sheet;
}

// ============================================================
// Utility functions
// ============================================================

function jsonResponse(statusCode, data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function logError(msg) {
  console.error(msg);
  // Also log to Google Apps Script's built-in logging
  Logger.log("ERROR: " + msg);
}

function formatDate(date) {
  var y = date.getFullYear();
  var m = ("0" + (date.getMonth() + 1)).slice(-2);
  var d = ("0" + date.getDate()).slice(-2);
  return y + m + d;
}

// Detect MIME type from filename or base64 header
function detectMimeType(filename, base64) {
  var ext = filename.split(".").pop().toLowerCase();
  var mimeMap = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "pdf": "application/pdf"
  };
  if (mimeMap[ext]) return mimeMap[ext];

  // Try to detect from base64 content
  if (base64.charAt(0) === "/" && base64.charAt(1) === "9") return "image/jpeg";
  if (base64.charAt(0) === "i" && base64.charAt(1) === "V") return "image/png";
  if (base64.charAt(0) === "U" && base64.charAt(1) === "s") return "image/webp";

  return "application/octet-stream";
}

// For testing: go to Run > setupTestFolder to create the folder structure
function setupTestFolder() {
  var folder = getOrCreateReceiptFolder(formatDate(new Date()));
  Logger.log("Folder URL: " + folder.getUrl());
}