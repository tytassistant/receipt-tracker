# Change Plan: Cache Folder ID for Faster Queries

## Problem
`getFolder: 743ms` — Searching Drive by name every query is slow.

## Solution
Cache folder ID in Script Properties after first lookup. Subsequent queries use `DriveApp.getFolderById()` (instant).

## Changes

### Code.gs

**1. New helper function to get/cached folder:**
```javascript
function getOrCreateRootFolderCached() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("RECEIPTS_FOLDER_ID");
  
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      // Folder was deleted, fall through to search
      Logger.log("Cached folder ID invalid, searching Drive...");
    }
  }
  
  // Search and cache
  var folders = DriveApp.getFoldersByName(RECEIPTS_FOLDER);
  if (folders.hasNext()) {
    var folder = folders.next();
    props.setProperty("RECEIPTS_FOLDER_ID", folder.getId());
    return folder;
  }
  
  // Create and cache
  var newFolder = DriveApp.createFolder(RECEIPTS_FOLDER);
  props.setProperty("RECEIPTS_FOLDER_ID", newFolder.getId());
  return newFolder;
}
```

**2. Update `handleQueryReceipts`:**
- Replace `getOrCreateRootFolder()` with `getOrCreateRootFolderCached()`

## Expected Improvement
- `getFolder` time: **743ms → ~10ms** (99% reduction)
- Server total: **1820ms → ~1100ms**

## Trade-offs
- If folder is deleted/moved, need to clear `RECEIPTS_FOLDER_ID` from Script Properties
- Adds one-time cache setup on first call

## Manual Step Required
None — cache auto-populates on first use.

## Deployment Required
Yes — redeploy Apps Script after changes.
