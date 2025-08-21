# Quick Start Guide

## Issues Fixed

✅ **React Hooks Error**: Fixed server-side auth code being bundled for client
✅ **JWT Authentication**: Implemented secure authentication system
✅ **OAuth Integration**: Added Google and GitHub OAuth support  
✅ **Database Schema**: Updated for OAuth and secure passwords
✅ **Caddy HTTPS**: Configured local HTTPS proxy

## Start Development

1. **Update Database Schema**:
   ```bash
   npx prisma db push
   ```

2. **Start with HTTPS**:
   ```bash
   # Install Caddy first (brew install caddy)
   npm run setup:caddy
   npm run dev:https
   ```

3. **Access App**: `https://localhost`

## Authentication Features

- **JWT tokens** with secure HTTP-only cookies
- **Password hashing** with bcrypt
- **OAuth support** for Google and GitHub
- **Automatic account linking** for existing emails

## Environment Setup

Required `.env` variables:
```env
JWT_SECRET="your-secure-random-string"
SESSION_SECRET="your-secure-random-string"

# Optional OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"  
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

## OAuth Setup (Optional)

### Google
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Add redirect URI: `https://localhost/auth/google/callback`

### GitHub  
1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Create OAuth App
3. Set callback URL: `https://localhost/auth/github/callback`

## Troubleshooting

- **Certificate warnings**: Run `caddy trust` to install local CA
- **React hooks error**: Fixed by using dynamic imports in loaders
- **Database permissions**: Use `npx prisma db push` instead of migrate if needed

The app is ready for secure local development!