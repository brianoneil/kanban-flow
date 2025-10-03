# Dokku Deployment Guide

This guide explains how to deploy the Kanban Flow application to a Dokku server.

## Prerequisites

- Dokku server set up and running
- External database (e.g., Neon, Supabase, Railway, etc.) with connection string
- Git remote configured for your Dokku server

## Deployment Steps

### 1. Create the Application on Dokku

```bash
# On your Dokku server
dokku apps:create kanban-flow
```

### 2. Set Environment Variables

```bash
# Set your database connection string
dokku config:set kanban-flow DATABASE_URL="your-database-connection-string"

# Set session secret
dokku config:set kanban-flow SESSION_SECRET=$(openssl rand -hex 32)

# Set Node environment
dokku config:set kanban-flow NODE_ENV=production

# Set port (Dokku default is 5000, but you can customize)
dokku config:set kanban-flow PORT=5000
```

### 3. Configure Domain (Optional)

```bash
# Set custom domain
dokku domains:set kanban-flow your-domain.com

# Or use default Dokku domain
dokku domains:set kanban-flow kanban-flow.your-dokku-server.com
```

### 4. Deploy the Application

```bash
# From your local project directory
git remote add dokku dokku@your-dokku-server.com:kanban-flow
git push dokku main
```

## Files Created for Deployment

- **`Procfile`**: Defines the web process and release command
- **`app.json`**: Configures buildpacks, environment variables, and health checks
- **`.dokku/DOKKU_SCALE`**: Sets the number of web processes
- **Health endpoint**: Added `/api/health` for Dokku health checks

## Process Types

- **`web`**: Runs the main application server
- **`release`**: Runs database migrations before deployment

## Environment Variables

The following environment variables are required:

- `DATABASE_URL`: PostgreSQL connection string from your hosted database provider
- `SESSION_SECRET`: Secret key for session management (automatically generated during setup)
- `NODE_ENV`: Set to "production"
- `PORT`: Port for the web server (default: 5000)

### Setting Environment Variables from Local .env File

If you have a local `.env` file with your database credentials, you can use the provided script to automatically set them on Dokku:

```bash
# Use the deployment script (recommended)
./scripts/deploy-env.sh kanban-flow

# Or set manually from .env file
dokku config:set kanban-flow DATABASE_URL="$(grep DATABASE_URL .env | cut -d '=' -f2 | tr -d '"')"

# Or set it manually with your connection string
dokku config:set kanban-flow DATABASE_URL="postgresql://username:password@hostname:port/database?sslmode=require"
```

#### Required .env File Format

Create a `.env` file in your project root with the following format:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:port/database?sslmode=require

# Optional: Session Secret (auto-generated if not provided)
# SESSION_SECRET=your-secret-key-here

# Optional: Port (defaults to 5000)
# PORT=5000
```

### Viewing Current Environment Variables

```bash
# View all environment variables for your app
dokku config kanban-flow

# View a specific environment variable
dokku config:get kanban-flow DATABASE_URL
```

## Health Checks

The application includes a health check endpoint at `/api/health` that Dokku uses to verify the application is running correctly.

## Scaling

To scale the application:

```bash
# Scale web processes
dokku ps:scale kanban-flow web=2

# Check current scaling
dokku ps:scale kanban-flow
```

## Logs

View application logs:

```bash
# View recent logs
dokku logs kanban-flow

# Follow logs in real-time
dokku logs kanban-flow -t
```

## Database Management

```bash
# Run database migrations manually
dokku run kanban-flow npm run db:push

# Access your hosted database directly using your provider's tools
# (e.g., Neon Console, Supabase Dashboard, etc.)
```

## SSL/TLS (Optional)

Enable Let's Encrypt SSL:

```bash
# Install Let's Encrypt plugin
dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git

# Enable SSL for your app
dokku letsencrypt:enable kanban-flow

# Auto-renew certificates
dokku letsencrypt:cron-job --add
```

## Troubleshooting

### Build Failures

1. Check build logs: `dokku logs kanban-flow`
2. Verify all dependencies are in `package.json`
3. Ensure build script runs successfully locally

### Database Connection Issues

1. Verify your hosted database is accessible and running
2. Check `DATABASE_URL` environment variable is correctly set
3. Ensure your database allows connections from your Dokku server's IP
4. Run migrations manually if needed

### Application Won't Start

1. Check that the `start` script in `package.json` is correct
2. Verify the built application exists in `dist/index.js`
3. Check environment variables are set correctly

## MCP Server Integration

The deployed application includes the integrated MCP server accessible at:
- HTTP endpoint: `https://your-domain.com/mcp`
- Health check: `https://your-domain.com/mcp/health`

For external MCP clients, use the published npm package instead:
```bash
npx kanban-mcp-server
```

## 🚀 Quick Deployment Summary

```bash
# On your Dokku server
dokku apps:create kanban-flow

# From your local machine (with .env file containing DATABASE_URL)
./scripts/deploy-env.sh kanban-flow
git remote add dokku dokku@your-server.com:kanban-flow
git push dokku main

# Or set environment variables manually:
# dokku config:set kanban-flow DATABASE_URL="your-hosted-database-connection-string"
# dokku config:set kanban-flow SESSION_SECRET=$(openssl rand -hex 32)
# dokku config:set kanban-flow NODE_ENV=production
```
