#!/bin/bash

echo "Setting up Caddy for local HTTPS development..."

# Check if Caddy is installed
if ! command -v caddy &> /dev/null; then
    echo "Caddy is not installed. Please install Caddy first:"
    echo ""
    echo "macOS: brew install caddy"
    echo "Ubuntu/Debian: sudo apt install caddy"
    echo "Or download from: https://caddyserver.com/download"
    echo ""
    exit 1
fi

# Trust Caddy's root certificate for local HTTPS
echo "Trusting Caddy's local CA certificate..."
caddy trust

echo ""
echo "Setup complete! To run the app with HTTPS:"
echo ""
echo "1. Start your Remix app: npm run dev"
echo "2. In another terminal, start Caddy: caddy run"
echo "3. Access your app at: https://localhost"
echo ""
echo "Note: You may need to accept the certificate warning on first visit."
echo ""
echo "For OAuth callbacks, use these URLs:"
echo "- Google: https://localhost/auth/google/callback"
echo "- GitHub: https://localhost/auth/github/callback"