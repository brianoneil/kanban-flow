#!/bin/bash

# Deploy environment variables to Dokku
# This script reads your local .env file and sets the variables on your Dokku app
# Designed for use with hosted databases (Neon, Supabase, Railway, etc.)
# Usage: ./scripts/deploy-env.sh <app-name>

set -e

APP_NAME=${1:-kanban-flow}
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your hosted database connection string:"
    echo "DATABASE_URL=postgresql://user:password@host/database?sslmode=require"
    exit 1
fi

echo "🚀 Setting environment variables for Dokku app: $APP_NAME"

# Read .env file and set variables on Dokku
while IFS='=' read -r key value; do
    # Skip empty lines and comments
    if [[ -z "$key" || "$key" =~ ^#.* ]]; then
        continue
    fi
    
    # Remove quotes from value if present
    value=$(echo "$value" | sed 's/^["'\'']//' | sed 's/["'\'']$//')
    
    echo "Setting $key..."
    dokku config:set "$APP_NAME" "$key=$value"
done < "$ENV_FILE"

# Set additional production variables
echo "Setting production environment variables..."
dokku config:set "$APP_NAME" NODE_ENV=production

# Generate session secret if not already set
if ! dokku config:get "$APP_NAME" SESSION_SECRET > /dev/null 2>&1; then
    echo "Generating SESSION_SECRET..."
    dokku config:set "$APP_NAME" SESSION_SECRET="$(openssl rand -hex 32)"
fi

echo "✅ Environment variables configured successfully!"
echo ""
echo "📋 Current configuration:"
dokku config "$APP_NAME"
