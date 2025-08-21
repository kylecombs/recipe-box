# Caddy HTTPS Setup for Local Development

This setup enables HTTPS on localhost for your Recipe app, which is required for secure authentication and OAuth flows.

## Prerequisites

1. **Install Caddy**:
   - macOS: `brew install caddy`
   - Ubuntu/Debian: `sudo apt install caddy`
   - Windows: Download from [caddyserver.com](https://caddyserver.com/download)

2. **Trust Caddy's Certificate Authority**:
   ```bash
   npm run setup:caddy
   # Or manually: caddy trust
   ```

## Quick Start

### Option 1: Using npm scripts (Recommended)
```bash
# Run both Remix dev server and Caddy proxy
npm run dev:https
```

This starts:
- Remix dev server on `http://localhost:3000`
- Caddy proxy on `https://localhost` (forwarding to port 3000)

### Option 2: Manual setup
```bash
# Terminal 1: Start Remix
npm run dev

# Terminal 2: Start Caddy
caddy run
```

### Option 3: Docker (Optional)
```bash
# Create external network first
docker network create caddy

# Start Caddy container
docker-compose -f docker-compose.caddy.yml up -d
```

## Configuration

The Caddyfile provides:

- **HTTPS on localhost**: Uses Caddy's internal CA
- **Security headers**: X-Content-Type-Options, X-Frame-Options, etc.
- **GZIP compression**: Automatic response compression
- **HTTP to HTTPS redirect**: Automatic redirect from http://localhost
- **CORS support**: For API calls if needed

### Alternative Domain (Optional)

Add to your `/etc/hosts` file:
```
127.0.0.1 recipe.local
```

Then access your app at `https://recipe.local`

## OAuth Configuration

Update your OAuth providers with HTTPS URLs:

### Google OAuth
- **Authorized redirect URI**: `https://localhost/auth/google/callback`
- **Authorized JavaScript origins**: `https://localhost`

### GitHub OAuth
- **Authorization callback URL**: `https://localhost/auth/github/callback`

## Environment Variables

Update your `.env` file if needed:
```env
# No changes needed - the app still runs on localhost:3000
# Caddy just proxies HTTPS traffic to it
```

## Troubleshooting

### Certificate Warnings
- Run `caddy trust` to install Caddy's root certificate
- Restart your browser after trusting the certificate

### Port Conflicts
- Make sure ports 80 and 443 are available
- Stop other web servers (Apache, Nginx) if running

### OAuth Issues
- Ensure redirect URIs in OAuth providers use `https://localhost`
- Check browser developer tools for mixed content warnings
- Verify cookies are being set with the Secure flag

## Development Workflow

1. **Start development**:
   ```bash
   npm run dev:https
   ```

2. **Access your app**: `https://localhost`

3. **View logs**: Caddy logs appear in the terminal

4. **Stop servers**: `Ctrl+C` stops both Remix and Caddy

## Production Notes

- This setup is for **local development only**
- For production, configure Caddy with your actual domain
- Use proper SSL certificates (Let's Encrypt via Caddy's automatic HTTPS)
- Consider using environment-specific Caddyfiles

## Files Created

- `Caddyfile`: Main Caddy configuration
- `setup-caddy.sh`: Setup script for trusting certificates
- `docker-compose.caddy.yml`: Optional Docker setup
- Updated `package.json`: Added convenience scripts