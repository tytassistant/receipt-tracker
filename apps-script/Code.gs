// ============================================================
// Receipt Tracker – Google Apps Script Backend (Code.gs)
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
  "Image_URL"     // K: Google Drive URL to the image
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
      r.imageUrl || ""              // Image_URL
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
      // Get all needed columns: A, B, E, F, G, H, I, J, K
      var allDataRange = sheet.getRange(2, 1, rowsCount, COLUMNS.length);
      var allData = allDataRange.getValues();
      
      for (var j = 0; j < matchingIndices.length; j++) {
        var idx = matchingIndices[j];
        var row = allData[idx];
        var recordNo = row[0];
        var dateCell = row[1];
        var description = row[4];
        var amount = parseFloat(row[5]) || 0;
        var currency = row[6];
        var category = row[7];
        var remarks = row[8];
        var imageName = row[9];
        var imageUrl = row[10];
        
        receipts.push({
          recordNo: recordNo,
          date: formatDateForResponse(dateCell),
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