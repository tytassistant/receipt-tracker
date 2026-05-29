#!/usr/bin/env python3
"""
Test script for queryReceipts Apps Script action.
Usage: python test_query_receipts.py <apps_script_url> <secret_token> [start_date] [end_date]
Example: python test_query_receipts.py https://script.google.com/macros/s/xxx/exec mytoken 2025-05-01 2025-05-26
"""

import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta

def test_query_receipts(url, token, start_date=None, end_date=None):
    """Test the queryReceipts action."""
    
    # Default to current month if not provided
    if not start_date:
        today = datetime.now()
        start_date = today.replace(day=1).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    print(f"Testing queryReceipts...")
    print(f"URL: {url}")
    print(f"Date range: {start_date} to {end_date}")
    print()
    
    payload = {
        "token": token,
        "action": "queryReceipts",
        "data": {
            "startDate": start_date,
            "endDate": end_date
        }
    }
    
    # Use text/plain to match CORS fix in index.html
    headers = {
        'Content-Type': 'text/plain;charset=utf-8'
    }
    
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers=headers,
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            response_body = response.read().decode('utf-8')
            print(f"HTTP Status: {response.status}")
            print(f"Response length: {len(response_body)} chars")
            print()
            
            try:
                result = json.loads(response_body)
                print("Parsed JSON result:")
                print(json.dumps(result, indent=2))
                print()
                
                if result.get('success'):
                    receipts = result.get('receipts', [])
                    print(f"\u2705 SUCCESS: Found {len(receipts)} receipts")
                    print(f"Total amount: {result.get('currency', 'HKD')} {result.get('totalAmount', 0)}")
                    
                    if receipts:
                        print("\nFirst receipt:")
                        print(json.dumps(receipts[0], indent=2))
                else:
                    print(f"\u274c ERROR: {result.get('error', 'Unknown error')}")
                    
            except json.JSONDecodeError as e:
                print(f"\u274c Failed to parse JSON: {e}")
                print(f"Raw response (first 500 chars):")
                print(response_body[:500])
                
    except urllib.error.HTTPError as e:
        print(f"\u274c HTTP Error {e.code}: {e.reason}")
        try:
            error_body = e.read().decode('utf-8')
            print(f"Error body: {error_body[:500]}")
        except:
            pass
    except Exception as e:
        print(f"\u274c Request failed: {type(e).__name__}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        print(f"\nUsage: {sys.argv[0]} <apps_script_url> <secret_token> [start_date] [end_date]")
        print("\nNOTE: If your token contains $, wrap it in single quotes to prevent shell expansion:")
        print("  python3 test_query_receipts.py 'URL' '8D6@6*P$WctFMnw8jHEr'")
        sys.exit(1)
    
    url = sys.argv[1]
    token = sys.argv[2]
    start_date = sys.argv[3] if len(sys.argv) > 3 else None
    end_date = sys.argv[4] if len(sys.argv) > 4 else None
    
    test_query_receipts(url, token, start_date, end_date)

# Hardcoded test for direct execution without shell expansion
def hardcoded_test():
    """Run test with hardcoded credentials to avoid shell expansion issues."""
    url = "https://script.google.com/macros/s/AKfycbyyf3Q3m0qkvIPaQZW9AFgXt74zdAaUInQlL3fAXKN8vW6laDlBeLtnYfGyi7EdWhjR/exec"
    token = "8D6@6*P$WctFMnw8jHEr"
    test_query_receipts(url, token, "2025-05-01", "2025-05-26")

# Uncomment to run hardcoded test:
# hardcoded_test()
