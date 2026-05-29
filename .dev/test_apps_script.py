#!/usr/bin/env python3
"""Test script for Google Apps Script Receipt Tracker API."""
import json
import urllib.request
import urllib.error

# ── CONFIG ──────────────────────────────────────────────────────────────────
APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyyf3Q3m0qkvIPaQZW9AFgXt74zdAaUInQlL3fAXKN8vW6laDlBeLtnYfGyi7EdWhjR/exec"
SECRET_TOKEN = "8D6@6*P$WctFMnw8jHEr"   # default placeholder from Code.gs

# ── TEST DATA ────────────────────────────────────────────────────────────────
upload_image_payload = {
    "token": SECRET_TOKEN,
    "action": "uploadImage",
    "data": {
        "filename": "test_receipt.jpg",
        "imageBase64": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAD...==",
        "folderDate": "20250525"
    }
}

save_receipts_payload = {
    "token": SECRET_TOKEN,
    "action": "saveReceipts",
    "data": {
        "receipts": [{
            "date": "2025-05-25",
            "description": "Test receipt",
            "amount": 123.45,
            "currency": "HKD",
            "category": "Food",
            "remarks": "Test from Python script",
            "imageUrl": "https://drive.google.com/test"
        }]
    }
}

get_folder_payload = {
    "token": SECRET_TOKEN,
    "action": "getFolder",
    "data": {"folderDate": "20250525"}
}

# ── HELPER ───────────────────────────────────────────────────────────────────
def post(payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        APPS_SCRIPT_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body) if body else {}
            print(f"  ✅ HTTP {resp.status}")
            print(f"     {json.dumps(result, indent=True)}")
            return result
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"  ❌ HTTP {e.code} {e.reason}")
        print(f"     Body: {body[:500]}")
        return None
    except urllib.error.URLError as e:
        print(f"  ❌ Network error: {e.reason}")
        return None

# ── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("Receipt Tracker — Apps Script API Test")
    print(f"URL: {APPS_SCRIPT_URL}")
    print(f"Token: {SECRET_TOKEN[:4]}***{SECRET_TOKEN[-2:]}")
    print("=" * 60)

    print("\n─── Test 1: getFolder ───")
    post(get_folder_payload)

    print("\n─── Test 2: uploadImage ───")
    post(upload_image_payload)

    print("\n─── Test 3: saveReceipts ───")
    post(save_receipts_payload)

    print("\nDone.")