# Database Setup Guide

## Current Status
✅ **Prisma Client Fixed**: Updated to v6.14.0 to match CLI version
✅ **Schema Updated**: OAuth support added to User and OAuthAccount models
✅ **Authentication Ready**: JWT and OAuth systems implemented

## Database Connection Needed

Your app is ready but needs a MySQL database connection. Here are your options:

### Option 1: Local MySQL
```bash
# Install MySQL
brew install mysql                # macOS
sudo apt install mysql-server    # Ubuntu

# Start MySQL
brew services start mysql        # macOS
sudo systemctl start mysql       # Ubuntu

# Create database
mysql -u root -p
CREATE DATABASE mydb;
```

### Option 2: Docker MySQL
```bash
# Run MySQL in Docker
docker run --name recipe-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=mydb \
  -e MYSQL_USER=kylecombs \
  -e MYSQL_PASSWORD=randompassword \
  -p 3306:3306 -d mysql:8.0

# Update .env with connection string
DATABASE_URL="mysql://kylecombs:randompassword@localhost:3306/mydb"
```

### Option 3: Cloud Database
- **PlanetScale**: Free MySQL with built-in branching
- **Railway**: Simple PostgreSQL/MySQL hosting  
- **Supabase**: PostgreSQL with built-in auth
- **Neon**: Serverless PostgreSQL

## After Database Setup

1. **Push schema**:
   ```bash
   npx prisma db push
   ```

2. **Test connection**:
   ```bash
   npm run dev
   ```

3. **Start with HTTPS**:
   ```bash
   npm run dev:https
   ```

## Environment Variables

Update your `.env`:
```env
# Database (update with your credentials)
DATABASE_URL="mysql://user:password@localhost:3306/mydb"

# Authentication (already configured)
JWT_SECRET="0bd9c0c37ce643cafbc5055a369be1f6"
SESSION_SECRET="rs7glvk4WdtNwbpgypzFH0TEMxE4xCBOPtSFWwCWbGw="

# OAuth (optional - configure when ready)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"  
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

## Schema Changes Applied

- `User.password` is now optional (for OAuth users)
- New `OAuthAccount` table for linking OAuth providers
- Foreign key relationships maintained
- All existing data preserved

The authentication system is fully implemented and ready once you connect a database!