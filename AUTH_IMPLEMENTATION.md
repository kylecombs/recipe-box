# Authentication Implementation

## Overview
I've implemented a real authentication system with JWT tokens and OAuth 2.0 support for your Recipe app. The system replaces the demo authentication with a secure, production-ready solution.

## Key Features

### 1. JWT Authentication
- Secure token-based authentication using JSON Web Tokens
- Tokens stored in HTTP-only cookies for security
- 30-day token expiration
- Token validation on every authenticated request

### 2. Password Security
- Passwords hashed using bcrypt with 10 salt rounds
- Minimum password length of 6 characters
- Secure password comparison

### 3. OAuth 2.0 Integration
- **Google OAuth**: Sign in with Google account
- **GitHub OAuth**: Sign in with GitHub account
- Automatic account linking for existing emails
- OAuth tokens stored securely in database

## Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:

```env
# Authentication
JWT_SECRET="your-secure-random-string"
SESSION_SECRET="your-secure-random-string"

# OAuth - Google
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OAuth - GitHub  
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### OAuth Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. Copy Client ID and Secret to `.env`

#### GitHub OAuth
1. Go to [GitHub Settings > Developer settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:3000/auth/github/callback`
4. Copy Client ID and Secret to `.env`

## Database Migration

Run the migration to add OAuth support:
```bash
npx prisma migrate dev
```

## Architecture

### Services
- **AuthService** (`app/services/auth.server.ts`): Core authentication logic
  - Password hashing and verification
  - JWT token generation and validation
  - User creation and authentication

- **OAuthService** (`app/services/oauth.server.ts`): OAuth provider integration
  - OAuth flow handling for Google and GitHub
  - User account linking
  - Token exchange and profile fetching

### Routes
- `/login`: Email/password login with OAuth options
- `/signup`: User registration with password
- `/logout`: Clear authentication cookie
- `/auth/google`: Initiate Google OAuth flow
- `/auth/google/callback`: Handle Google OAuth callback
- `/auth/github`: Initiate GitHub OAuth flow
- `/auth/github/callback`: Handle GitHub OAuth callback

### Utilities
- **jwt.server.ts**: JWT token management and auth helpers
  - `requireAuth()`: Enforce authentication on routes
  - `getOptionalUser()`: Get user if authenticated
  - Cookie management functions

## Security Features
- HTTP-only cookies prevent XSS attacks
- Secure flag on cookies (in production)
- SameSite=Lax for CSRF protection
- Constant-time password comparison
- OAuth state parameter for security
- Automatic token expiration

## Usage in Routes

Protected routes use the authentication helpers:
```typescript
import { requireUserId } from "~/utils/auth.server";

export const loader = async ({ request }) => {
  const userId = await requireUserId(request);
  // User is authenticated, userId is available
};
```

## Notes
- The old session-based auth is replaced with JWT tokens
- All existing routes continue to work with the new auth system
- OAuth accounts are linked to users via the OAuthAccount table
- Users can have multiple OAuth providers linked to one account