#!/usr/bin/env python3
import json
import urllib.request
import urllib.parse

def test_service():
    try:
        # Test health endpoint
        req = urllib.request.Request('http://localhost:8001/')
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            print("Health check:", data)
            return True
    except Exception as e:
        print(f"Service test failed: {e}")
        return False

if __name__ == '__main__':
    if test_service():
        print("✅ Service is running correctly!")
    else:
        print("❌ Service is not responding")