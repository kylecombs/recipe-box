#!/bin/bash

echo "This script will apply schema changes without migrations (development only)"
echo "For production, use proper migrations"
echo ""

# This command syncs your schema with the database without migrations
npx prisma db push

# Generate Prisma Client
npx prisma generate

echo "Schema sync complete!"