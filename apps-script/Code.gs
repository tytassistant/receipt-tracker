// ============================================================
// Receipt Tracker – Google Apps Script Backend (Code.gs)
// Version: v1.0 | Date: 2026-05-28
// ============================================================

// Folder name in Google Drive where receipts are stored
const RECEIPTS_FOLDER = "receipt-tracker";

// Spreadsheet name (Google Sheets — no extension)
const SPREADSHEET_NAME = "receipts-database";

// Column headers — exact column order
const COLUMNS = [
  "Record_no",    // A: Auto-incrementing integer per spreadsheet
  "Date",         // B: From receipt data (YYYY-MM-DD)
  "Created_at",   // C: HKT timestamp of row creation
  "Modified_at",  // D: HKT timestamp, same as Created_at on insert
  "Description",  // E: From receipt data
  "Amount",       // F: From receipt data (number)
  "Currency",     // G: From receipt data
  "Category",     // H: From receipt data
  "Remarks",      // I: From receipt data
  "Image_name",   // J: Uploaded image filename (YYYYMMDD_HHmmSS_originalname)
  "Image_URL",    // K: Google Drive URL to the image
  "ID",            // L: UUID v4 for unique identification
  "Reviewed",     // M: 0 or 1
  "Reviewed_at"   // N: HKT timestamp when first marked reviewed
];

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
    } else if (action === "queryReceipts") {
      return handleQueryReceipts(data);
    } else if (action === "updateReceipt") {
      return handleUpdateReceipt(data);
    } else if (action === "deleteReceipt") {
      return handleDeleteReceipt(data);
    } else if (action === "queryReviewed") {
      return handleQueryReviewed(data);
    } else if (action === "saveReviewed") {
      return handleSaveReviewed(data);
    } else if (action === "getImageBase64") {
      return handleGetImageBase64(data);
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
  var secret = PropertiesService.getScriptProperties().getProperty("SECRET_TOKEN");
  return token && secret && token === secret;
}

// ============================================================
// Action: getImageBase64
// Fetches a Google Drive image file and returns as base64 data URL
// Uses DriveApp (no CORS, runs as authenticated user)
// data: { fileId: string }
// ============================================================
function handleGetImageBase64(data) {
  var fileId = data.fileId;
  if (!fileId) {
    return jsonResponse(400, { error: "fileId is required" });
  }
  
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var contentType = blob.getContentType();
    var base64 = Utilities.base64Encode(blob.getBytes());
    var dataUrl = "data:" + contentType + ";base64," + base64;
    return jsonResponse(200, {
      success: true,
      dataUrl: dataUrl
    });
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
}

// ============================================================
// Action: uploadImage
// Saves a base64 image to Drive/receipt-tracker/YYYYMMDD/
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

  // Generate HKT timestamp filename: YYYYMMDD_HHmmSS_originalname
  var now = new Date();
  var hktTimestamp = formatHKTCompact(now); // YYYYMMDD_HHmmSS
  var safeOriginalName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  var timestampedFilename = hktTimestamp + "_" + safeOriginalName;

  // Get or create the date folder inside /receipt-tracker/
  var folder = getOrCreateReceiptFolder(folderDate);

  // Create and save the file with timestamped name
  var file = folder.createFile(Utilities.newBlob(blob, mimeType, timestampedFilename));

  return jsonResponse(200, {
    success: true,
    filename: timestampedFilename,
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
    Logger.log("ERROR: receipts array is missing or empty");
    return jsonResponse(400, { error: "receipts array is required" });
  }

  Logger.log("Saving " + receipts.length + " receipt(s)");
  Logger.log("First receipt data: " + JSON.stringify(receipts[0]));

  var sheet = getOrCreateSheet();
  Logger.log("Sheet opened: " + sheet.getName() + " in " + sheet.getParent().getName());
  var now = new Date();
  var createdAt = formatHKT(now);
  var modifiedAt = formatHKT(now);
  var savedCount = 0;
  var savedIds = [];

  // Calculate next Record_no
  // Find the max existing Record_no (column A, skip header row 1)
  var lastRecordNo = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var recordNos = sheet.getRange(2, 1, lastRow - 1, 1).getValues(); // Column A
    for (var i = 0; i < recordNos.length; i++) {
      var val = recordNos[i][0];
      if (typeof val === "number" && val > lastRecordNo) {
        lastRecordNo = val;
      }
    }
  }

  // Parse date string to Date object for sheet storage
  function parseDateStringToObject(dateStr) {
    if (!dateStr) return new Date(); // Default to today if empty
    if (dateStr instanceof Date) return dateStr;
    var parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  for (var i = 0; i < receipts.length; i++) {
    var r = receipts[i];
    var recordNo = lastRecordNo + i + 1;

    var receiptId = Utilities.getUuid(); // Generate UUID for this receipt

    var row = [
      recordNo,                       // Record_no
      parseDateStringToObject(r.date), // Date as Date object
      createdAt,                      // Created_at (HKT)
      modifiedAt,                     // Modified_at (HKT) — same on insert
      r.description || "",            // Description
      parseFloat(r.amount) || 0,      // Amount
      r.currency || "HKD",           // Currency
      r.category || "Others",        // Category
      r.remarks || "",                // Remarks
      r.imageName || "",             // Image_name (timestamped filename)
      r.imageUrl || "",              // Image_URL
      receiptId                       // ID (UUID v4)
    ];

    sheet.appendRow(row);
    savedIds.push(receiptId);
    savedCount++;
  }

  return jsonResponse(200, {
    success: true,
    saved: savedCount,
    ids: savedIds,
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
// Action: queryReceipts
// Query receipts from sheet by date range
// data: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
// Returns: { success: true, receipts: [...], totalAmount: number }
// ============================================================
// Parse YYYY-MM-DD string to Date object (at midnight in local timezone)
function parseDateInput(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  var parts = dateStr.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

// Format Date object to YYYY-MM-DD string for JSON response
function formatDateForResponse(dateObj) {
  if (!dateObj) return '';
  if (!(dateObj instanceof Date)) return String(dateObj);
  var y = dateObj.getFullYear();
  var m = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  var d = ('0' + dateObj.getDate()).slice(-2);
  return y + '-' + m + '-' + d;
}

function handleQueryReceipts(data) {
  var startTime = new Date().getTime();
  var timings = {};
  
  var startDate = data.startDate;
  var endDate = data.endDate;

  if (!startDate || !endDate) {
    return jsonResponse(400, { error: "startDate and endDate are required (YYYY-MM-DD format)" });
  }

  // Parse input strings to Date objects for comparison
  var startDateObj = parseDateInput(startDate);
  var endDateObj = parseDateInput(endDate);
  // Set end date to end of day for inclusive comparison
  endDateObj.setHours(23, 59, 59, 999);
  timings.parseDates = new Date().getTime() - startTime;

  // Direct folder access with ID caching for performance
  var folderStart = new Date().getTime();
  var rootFolder = getOrCreateRootFolder();
  timings.getFolder = new Date().getTime() - folderStart;
  
  var sheetStart = new Date().getTime();
  var sheet;
  var files = rootFolder.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    var spreadsheet = SpreadsheetApp.open(files.next());
    sheet = spreadsheet.getSheetByName("Receipts");
  } else {
    // Fallback to creating if missing
    Logger.log("[queryReceipts] Spreadsheet not found, creating new one");
    sheet = getOrCreateSheet();
  }
  timings.openSheet = new Date().getTime() - sheetStart;

  var dataFetchStart = new Date().getTime();
  var lastRow = sheet.getLastRow();
  timings.checkRowCount = new Date().getTime() - dataFetchStart;

  var receipts = [];
  var totalAmount = 0;

  if (lastRow > 1) {
    // Fetch only needed columns: A(1), B(2), E(5), F(6), G(7) for efficiency
    // Get them in separate calls to minimize data transfer
    var rangeStart = new Date().getTime();
    var rowsCount = lastRow - 1;
    
    // Get dates (column B) for filtering
    var datesRange = sheet.getRange(2, 2, rowsCount, 1);
    var datesData = datesRange.getValues();
    
    // Get other data columns only for rows that match date range
    // First pass: identify matching row indices
    var matchingIndices = [];
    for (var i = 0; i < datesData.length; i++) {
      var dateCell = datesData[i][0];
      if (dateCell instanceof Date && 
          dateCell.getTime() >= startDateObj.getTime() && 
          dateCell.getTime() <= endDateObj.getTime()) {
        matchingIndices.push(i);
      }
    }
    
    // Second pass: fetch full row data only for matching rows
    if (matchingIndices.length > 0) {
      // Get all needed columns: A-L (all COLUMNS)
      var allDataRange = sheet.getRange(2, 1, rowsCount, COLUMNS.length);
      var allData = allDataRange.getValues();
      
      for (var j = 0; j < matchingIndices.length; j++) {
        var idx = matchingIndices[j];
        var row = allData[idx];
        var recordNo = row[0];
        var dateCell = row[1];
        var createdAt = row[2];
        var modifiedAt = row[3];
        var description = row[4];
        var amount = parseFloat(row[5]) || 0;
        var currency = row[6];
        var category = row[7];
        var remarks = row[8];
        var imageName = row[9];
        var imageUrl = row[10];
        var id = row[11]; // Column 12 - UUID
        
        receipts.push({
          id: id,
          recordNo: recordNo,
          date: formatDateForResponse(dateCell),
          createdAt: createdAt,
          modifiedAt: modifiedAt,
          description: description,
          amount: amount,
          currency: currency,
          category: category,
          remarks: remarks,
          imageName: imageName,
          imageUrl: imageUrl
        });
        totalAmount += amount;
      }
    }
    timings.fetchAndFilter = new Date().getTime() - rangeStart;
  }

  var totalTime = new Date().getTime() - startTime;
  Logger.log("[queryReceipts] Total: " + totalTime + "ms | Folder: " + timings.getFolder + 
             "ms | Sheet: " + timings.openSheet + "ms | Data: " + (timings.fetchAndFilter || 0) + "ms");

  return jsonResponse(200, {
    success: true,
    startDate: startDate,
    endDate: endDate,
    count: receipts.length,
    receipts: receipts,
    totalAmount: totalAmount,
    timing: {
      totalMs: totalTime,
      steps: timings
    }
  });
}

// ============================================================
// Drive folder management
// ============================================================

// Get folder by ID from Script Properties (instant, no search)
function getFolderByIdCached() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("RECEIPTS_FOLDER_ID");
  
  if (!folderId) {
    throw new Error("RECEIPTS_FOLDER_ID not set in Script Properties");
  }
  
  try {
    return DriveApp.getFolderById(folderId);
  } catch (e) {
    throw new Error("Invalid RECEIPTS_FOLDER_ID or folder was deleted: " + folderId);
  }
}

// Get or create the root /receipt-tracker/ folder (fallback to name search if no ID)
function getOrCreateRootFolder() {
  // Try ID-based lookup first
  try {
    var folder = getFolderByIdCached();
    Logger.log("[getOrCreateRootFolder] Using cached folder ID");
    return folder;
  } catch (e) {
    Logger.log("[getOrCreateRootFolder] ID lookup failed, falling back to name search: " + e.message);
  }
  
  // Fallback: search by name
  var folders = DriveApp.getFoldersByName(RECEIPTS_FOLDER);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(RECEIPTS_FOLDER);
}

// Get or create /receipt-tracker/YYYYMMDD/ folder
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
// Creates INSIDE the receipt-tracker folder, no duplicates
function getOrCreateSheet() {
  var root = getOrCreateRootFolder();
  Logger.log("Root folder: " + root.getName() + " (" + root.getId() + ")");

  // Search for existing spreadsheet by name (Google Sheets — no file extension)
  var files = root.getFilesByName(SPREADSHEET_NAME);
  var spreadsheet;

  if (files.hasNext()) {
    // Found existing spreadsheet — open it
    var file = files.next();
    Logger.log("Found existing spreadsheet: " + file.getName() + " (" + file.getId() + ")");
    spreadsheet = SpreadsheetApp.openById(file.getId());
  } else {
    // Create new spreadsheet inside the receipt-tracker folder
    Logger.log("Creating new spreadsheet: " + SPREADSHEET_NAME);
    var ssId = SpreadsheetApp.create(SPREADSHEET_NAME).getId();
    var file = DriveApp.getFileById(ssId);
    Logger.log("Created spreadsheet ID: " + ssId);

    // Move file into the receipts folder
    root.addFile(file);
    Logger.log("Added file to root folder");
    DriveApp.getRootFolder().removeFile(file);
    Logger.log("Removed file from root");

    spreadsheet = SpreadsheetApp.openById(ssId);
  }

  // Get or create the "Receipts" sheet tab
  var sheetName = "Receipts";
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("Creating new sheet tab: " + sheetName);
    sheet = spreadsheet.insertSheet(sheetName);
  } else {
    Logger.log("Found existing sheet tab: " + sheetName);
  }

  Logger.log("Sheet row count: " + sheet.getLastRow());

  // Add header row if sheet is empty (no rows, or only header row without data)
  if (sheet.getLastRow() === 0 || (sheet.getLastRow() === 1 && sheet.getRange(1, 1).getValue() === "")) {
    Logger.log("Adding header row");
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);

    // Style header row
    var headerRange = sheet.getRange(1, 1, 1, COLUMNS.length);
    headerRange.setBackground("#f8f9fa").setFontWeight("bold");
    spreadsheet.setFrozenRows(1);
    Logger.log("Header row added");
  }

  return sheet;
}

// ============================================================
// Utility functions
// ============================================================

// Format date to HKT (GMT+8): "YYYY-MM-DD HH:mm:ss"
function formatHKT(date) {
  return Utilities.formatDate(date, "GMT+8", "yyyy-MM-dd HH:mm:ss");
}

// Format date to HKT compact: "YYYYMMDD_HHmmSS" for filenames
function formatHKTCompact(date) {
  return Utilities.formatDate(date, "GMT+8", "yyyyMMdd_HHmmss");
}

// Format date to YYYYMMDD for folder names
function formatDate(date) {
  var y = date.getFullYear();
  var m = ("0" + (date.getMonth() + 1)).slice(-2);
  var d = ("0" + date.getDate()).slice(-2);
  return y + m + d;
}

// JSON response helper
function jsonResponse(statusCode, data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Error logging
function logError(msg) {
  Logger.log("ERROR: " + msg);
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

  // Detect from base64 content
  if (base64.charAt(0) === "/" && base64.charAt(1) === "9") return "image/jpeg";
  if (base64.charAt(0) === "i" && base64.charAt(1) === "V") return "image/png";
  if (base64.charAt(0) === "U" && base64.charAt(1) === "s") return "image/webp";

  return "application/octet-stream";
}

// ============================================================
// Action: updateReceipt
// Updates an existing receipt by ID
// data: { id, description, date, amount, currency, category, remarks }
// ============================================================
function handleUpdateReceipt(data) {
  var id = data.id;
  if (!id) {
    return jsonResponse(400, { error: "id is required" });
  }

  var sheet = getOrCreateSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse(404, { error: "No receipts found" });
  }

  // Find the row with matching ID in column 12
  var idColumn = 12; // Column L
  var idRange = sheet.getRange(2, idColumn, lastRow - 1, 1);
  var idValues = idRange.getValues();

  var rowIndex = -1;
  for (var i = 0; i < idValues.length; i++) {
    if (idValues[i][0] === id) {
      rowIndex = i + 2; // +2 because: +1 for header row, +1 for 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse(404, { error: "Receipt not found: " + id });
  }

  // Parse date
  function parseDateStringToObject(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    var parts = dateStr.split("-");
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  var modifiedAt = formatHKT(new Date());

  // Write to each target column individually so we skip C (Created_at) and target I (Remarks) correctly
  // Column targets: B=date, D=modifiedAt, E=description, F=amount, G=currency, H=category, I=remarks
  sheet.getRange(rowIndex, 2).setValue(parseDateStringToObject(data.date));            // B: Date
  sheet.getRange(rowIndex, 4).setValue(modifiedAt);                                    // D: Modified_at
  sheet.getRange(rowIndex, 5).setValue(data.description || "");                      // E: Description
  sheet.getRange(rowIndex, 6).setValue(parseFloat(data.amount) || 0);                // F: Amount
  sheet.getRange(rowIndex, 7).setValue(data.currency || "HKD");                       // G: Currency
  sheet.getRange(rowIndex, 8).setValue(data.category || "Other");                     // H: Category
  sheet.getRange(rowIndex, 9).setValue(data.remarks || "");                           // I: Remarks

  return jsonResponse(200, {
    success: true,
    updated: 1,
    id: id,
    modifiedAt: modifiedAt
  });
}

// ============================================================
// Action: deleteReceipt
// Deletes a receipt row by ID
// data: { id }
// ============================================================
function handleDeleteReceipt(data) {
  var id = data.id;
  if (!id) {
    return jsonResponse(400, { error: "id is required" });
  }

  var sheet = getOrCreateSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse(404, { error: "No receipts found" });
  }

  // Find the row with matching ID in column 12
  var idColumn = 12; // Column L
  var idRange = sheet.getRange(2, idColumn, lastRow - 1, 1);
  var idValues = idRange.getValues();

  var rowIndex = -1;
  for (var i = 0; i < idValues.length; i++) {
    if (idValues[i][0] === id) {
      rowIndex = i + 2; // +2: header row + 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse(404, { error: "Receipt not found: " + id });
  }

  // Read imageUrl from the row before deleting (to get file ID)
  var imageUrlCell = sheet.getRange(rowIndex, 11).getValue(); // Column K: Image_URL

  // Delete the entire row
  sheet.deleteRows(rowIndex, 1);

  // Try to move the image file to trash
  if (imageUrlCell && typeof imageUrlCell === "string") {
    var fileIdMatch = imageUrlCell.match(/file\/d\/([^/?]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      try {
        var file = DriveApp.getFileById(fileIdMatch[1]);
        file.setTrashed(true); // Move to trash (does not permanently delete)
        Logger.log("Moved file to trash: " + fileIdMatch[1]);
      } catch (e) {
        Logger.log("Could not trash file " + fileIdMatch[1] + ": " + e.message);
      }
    }
  }

  return jsonResponse(200, {
    success: true,
    deleted: 1,
    id: id
  });
}

// ============================================================
// Action: queryReviewed
// Returns only unreviewed receipts in date range (Reviewed_at == "")
// ============================================================
function handleQueryReviewed(data) {
  var startDate = data.startDate;
  var endDate = data.endDate;
  if (!startDate || !endDate) {
    return jsonResponse(400, { error: "startDate and endDate are required" });
  }

  var sheet = getOrCreateSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse(200, { success: true, receipts: [], count: 0 });
  }

  var startDateObj = parseDateInput(startDate);
  var endDateObj = parseDateInput(endDate);
  endDateObj.setHours(23, 59, 59, 999);

  var rowsCount = lastRow - 1;
  var allData = sheet.getRange(2, 1, rowsCount, COLUMNS.length).getValues();
  var receipts = [];

  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    var dateCell = row[1]; // Column B: Date
    var reviewedAt = row[13]; // Column N: Reviewed_at

    // Only include if: date matches AND Reviewed_at is empty (not yet reviewed)
    if (dateCell instanceof Date &&
        dateCell.getTime() >= startDateObj.getTime() &&
        dateCell.getTime() <= endDateObj.getTime() &&
        (!reviewedAt || reviewedAt === "")) {

      receipts.push({
        id: row[11],
        recordNo: row[0],
        date: formatDateForResponse(dateCell),
        createdAt: row[2],
        modifiedAt: row[3],
        description: row[4],
        amount: parseFloat(row[5]) || 0,
        currency: row[6],
        category: row[7],
        remarks: row[8],
        imageName: row[9],
        imageUrl: row[10],
        reviewed: parseInt(row[12]) || 0, // Column M
        reviewedAt: row[13] || ""
      });
    }
  }

  return jsonResponse(200, { success: true, receipts: receipts, count: receipts.length });
}

// ============================================================
// Action: saveReviewed
// Updates one or more reviewed receipts
// data: { receipts: [{ id, description, date, amount, currency, category, remarks, reviewed }] }
// ============================================================
function handleSaveReviewed(data) {
  var receiptList = data.receipts;
  if (!receiptList || !Array.isArray(receiptList) || receiptList.length === 0) {
    return jsonResponse(400, { error: "receipts array is required" });
  }

  var sheet = getOrCreateSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse(404, { error: "No receipts found" });
  }

  // Read all IDs and Reviewed columns at once for fast lookup
  var idRange = sheet.getRange(2, 12, lastRow - 1, 1).getValues(); // Column L: ID
  var reviewedRange = sheet.getRange(2, 13, lastRow - 1, 1).getValues(); // Column M: Reviewed
  var saved = 0;
  var errors = [];
  var now = new Date();
  var modifiedAt = formatHKT(now);
  var hktDate = now; // for parseDateStringToObject

  function parseDateString(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    var parts = String(dateStr).split("-");
    if (parts.length < 3) return null;
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  for (var r = 0; r < receiptList.length; r++) {
    var rData = receiptList[r];
    var rowIndex = -1;

    // Find row by ID
    for (var i = 0; i < idRange.length; i++) {
      if (idRange[i][0] === rData.id) {
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) {
      errors.push("ID not found: " + rData.id);
      continue;
    }

    // Determine Reviewed_at value
    // Only set Reviewed_at when reviewed==1 AND Reviewed was previously 0 (first review)
    var currentReviewed = parseInt(reviewedRange[rowIndex - 2][0]) || 0;
    var newReviewed = parseInt(rData.reviewed) || 0;
    var reviewedAtValue = "";

    if (newReviewed === 1) {
      if (currentReviewed === 0) {
        // First time marking as reviewed — set timestamp
        reviewedAtValue = formatHKT(now);
      } else {
        // Already reviewed before — keep existing timestamp
        var existingCell = sheet.getRange(rowIndex, 14).getValue();
        reviewedAtValue = existingCell || "";
      }
    }
    // If newReviewed == 0, Reviewed_at stays empty

    // Build row update: B=date, C=modifiedAt, E=description, F=amount, G=currency, H=category, I=remarks, M=reviewed, N=reviewedAt
    var updatedRow = [
      [parseDateString(rData.date) || sheet.getRange(rowIndex, 2).getValue(),
       modifiedAt,
       rData.description || "",
       parseFloat(rData.amount) || 0,
       rData.currency || "HKD",
       rData.category || "Other",
       rData.remarks || "",
       newReviewed,
       reviewedAtValue]
    ];

    // Write to columns B, D, E, F, G, H, I, M, N
    sheet.getRange(rowIndex, 2, 1, 1).setValue(updatedRow[0][0]);               // B: Date
    sheet.getRange(rowIndex, 4, 1, 1).setValue(modifiedAt);                      // D: Modified_at
    sheet.getRange(rowIndex, 5, 1, 1).setValue(updatedRow[0][2]);               // E: Description
    sheet.getRange(rowIndex, 6, 1, 1).setValue(updatedRow[0][3]);               // F: Amount
    sheet.getRange(rowIndex, 7, 1, 1).setValue(updatedRow[0][4]);               // G: Currency
    sheet.getRange(rowIndex, 8, 1, 1).setValue(updatedRow[0][5]);               // H: Category
    sheet.getRange(rowIndex, 9, 1, 1).setValue(updatedRow[0][6]);               // I: Remarks
    sheet.getRange(rowIndex, 13, 1, 1).setValue(newReviewed);                   // M: Reviewed
    sheet.getRange(rowIndex, 14, 1, 1).setValue(reviewedAtValue);               // N: Reviewed_at

    saved++;
  }

  if (errors.length > 0) {
    return jsonResponse(200, { success: true, saved: saved, errors: errors });
  }
  return jsonResponse(200, { success: true, saved: saved });
}

// ============================================================
// Test / setup helpers
// ============================================================

// Run once to set up the folder structure and create the spreadsheet
// In Apps Script: Run → setupReceiptTracker
function setupReceiptTracker() {
  var root = getOrCreateRootFolder();
  Logger.log("Root folder: " + root.getName() + " — " + root.getUrl());

  // Today's date folder
  var today = formatDate(new Date());
  var todayFolder = getOrCreateReceiptFolder(today);
  Logger.log("Today folder (" + today + "): " + todayFolder.getUrl());

  // Ensure spreadsheet exists
  var sheet = getOrCreateSheet();
  Logger.log("Spreadsheet: " + sheet.getParent().getName() + " — " + sheet.getParent().getUrl());

  Logger.log("Setup complete.");
}

// For testing: create today's folder manually
// In Apps Script: Run → setupTodayFolder
function setupTodayFolder() {
  var today = formatDate(new Date());
  var folder = getOrCreateReceiptFolder(today);
  Logger.log("Folder URL: " + folder.getUrl());
  return folder.getUrl();
}