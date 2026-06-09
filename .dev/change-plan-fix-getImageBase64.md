# Change Plan: Fix getImageBase64 — Use DriveApp Instead of UrlFetchApp

**Status:** DRAFT — Do not apply yet
**Date:** 2026-05-29

---

## Problem

`handleGetImageBase64` uses `UrlFetchApp.fetch('https://drive.google.com/uc?export=view&id=...')`.

**Why it fails:**
- `drive.google.com/uc?export=view` is a browser-targeted endpoint — requires cookies/session
- Server-side `UrlFetchApp` gets HTML (login page or virus-scan warning page) instead of image bytes
- `getBytes()` then encodes HTML as base64 → garbage

**Evidence:** User sees `getImageBase64` request never appears in Network tab → frontend wasn't calling it (old code tried direct fetch). After fixing frontend to call Apps Script, still fails because Apps Script can't fetch via `uc?export=view` either.

---

## Solution Architecture

```
User clicks "Review with AI"
  → reviewWithAI() extracts fileId from stored imageUrl
  → imageUrlToDataUrl(fileId) → Apps Script endpoint
    → DriveApp.getFileById(fileId).getBlob().getBytes()  [server-side, authenticated]
    → returns base64 data URL
  → Send dataUrl to Poe API
  → Update spreadsheet
```

**Why DriveApp works:**
- `DriveApp.getFileById()` uses the script owner's authenticated Google session
- No external HTTP request, no cookies, no redirects, no CORS
- Returns raw bytes directly from Drive storage
- Works for any file the script owner has access to (including private files)

---

## Changes

### 1. Code.gs — Replace `handleGetImageBase64`

Replace the `UrlFetchApp` approach with `DriveApp`:

```javascript
// ============================================================
// Action: getImageBase64
// Fetches a Drive file directly using DriveApp (authenticated)
// data: { fileId?: string, imageUrl?: string }
// Returns: { success, dataUrl, mimeType, sizeBytes }
// ============================================================
function handleGetImageBase64(data) {
  var fileId = data.fileId;

  // Accept either a fileId or a full Drive URL (extract the ID)
  if (!fileId && data.imageUrl) {
    fileId = extractDriveFileId(data.imageUrl);
  }

  if (!fileId) {
    return jsonResponse(400, { error: "fileId or imageUrl is required" });
  }

  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var contentType = blob.getContentType() || "image/jpeg";

    // Reject non-image MIME types early
    if (contentType.indexOf("image/") !== 0 && contentType !== "application/pdf") {
      return jsonResponse(400, {
        error: "File is not an image: " + contentType
      });
    }

    var bytes = blob.getBytes();
    var base64 = Utilities.base64Encode(bytes);
    var dataUrl = "data:" + contentType + ";base64," + base64;

    return jsonResponse(200, {
      success: true,
      fileId: fileId,
      mimeType: contentType,
      sizeBytes: bytes.length,
      dataUrl: dataUrl
    });
  } catch (err) {
    return jsonResponse(500, {
      error: "Failed to read Drive file " + fileId + ": " + err.message
    });
  }
}

// Helper: extract Drive file ID from various URL formats
function extractDriveFileId(url) {
  if (!url) return null;
  var patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = url.match(patterns[i]);
    if (m && m[1]) return m[1];
  }
  return null;
}
```

**Key changes from current:**
- Removed `UrlFetchApp.fetch()` with `uc?export=view` URL
- Added `DriveApp.getFileById(fileId).getBlob()` for direct Drive access
- Added MIME type validation (reject HTML error pages)
- Added `extractDriveFileId()` helper to accept full URLs or just fileId
- Returns richer response: `{ success, fileId, mimeType, sizeBytes, dataUrl }`

**Required Apps Script scopes:**
- `https://www.googleapis.com/auth/drive.read` (or `drive.file` or `drive`, whichever is currently used)

---

### 2. index.html — Update `imageUrlToDataUrl`

Replace the canvas/fetch approach with Apps Script proxy:

```javascript
async function imageUrlToDataUrl(imageUrl) {
  // imageUrl is the full Drive URL like:
  // https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
  const fileIdMatch = imageUrl?.match(/\/file\/d\/([^/?]+)/);
  if (!fileIdMatch) return null;
  const fileId = fileIdMatch[1];

  try {
    const cfg = await loadConfig();
    const response = await fetch(cfg.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: cfg.secretToken,
        action: 'getImageBase64',
        data: { fileId: fileId }
      })
    });
    const result = await response.json();
    return result.success ? result.dataUrl : null;
  } catch (e) {
    console.error('Image fetch via Apps Script failed:', e);
    return null;
  }
}
```

**Key changes from current:**
- No more `new Image()` + canvas approach
- No more `fetch('drive.google.com/...')` from browser
- Uses Apps Script as proxy: `action: 'getImageBase64'`
- `result.dataUrl` is already a full `data:image/...;base64,...` string
- Falls back to `null` on any failure

---

## Discussion Points

1. **DriveApp vs Drive API:** `DriveApp` works for files accessible to the script owner. If files are in a Shared Drive, may need `Drive.Files.get(fileId, { alt: 'media' })` with `drive.google.com/auth/drive` scope.

2. **Size limit:** Apps Script blob limit is 50MB. Receipt photos are well under this.

3. **MIME type handling:** Currently returns error for non-images. Should it instead try to extract anyway? (Receipt app only handles images, so strict validation is fine.)

4. **Caching:** Currently every "Review with AI" call re-fetches the image from Drive. Should we cache the base64 in memory for the session? (Minor optimization for multi-record reviews.)

5. **Existing `getImageBase64` calls:** The backend already has `handleGetImageBase64`. We're replacing its implementation, not adding new endpoints. Frontend is already calling `imageUrlToDataUrl` → already calls `getImageBase64`. So only the backend implementation changes + frontend URL parsing improves.

6. **Testing:** After applying, user should see `getImageBase64` appear in Network tab (filtered by `getImageBase64` or `exec`). Status should be 200, response should include `success: true` and `dataUrl` starting with `data:image/...`.

---

## Files to Edit

- `/home/shared/documents/programs/receipt-tracker/apps-script/Code.gs`
  - Replace `handleGetImageBase64()` implementation
  - Add `extractDriveFileId()` helper function

- `/home/shared/documents/programs/receipt-tracker/index.html`
  - Replace `imageUrlToDataUrl()` implementation
  - (Optional) Remove `compressImage` call since DriveApp already returns full image; or keep it to reduce token usage

## Deployment

- After Code.gs changes: `cd apps-script && clasp push --force && clasp deploy -i AKfycbyb_rQDbHMxgkpYQ4gUFzBdGqqI-KY23gA8Zb2rghWYSF-7Uzn4vrlTBToOmnCERWI7`
- After index.html changes: push to GitHub Pages (`git push`)
- No new deployment ID needed