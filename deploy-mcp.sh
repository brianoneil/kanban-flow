#!/bin/bash

# Kanban MCP Remote Server Deployment Script
# This script builds and deploys the remote MCP server for production use

set -e

echo "🚀 Deploying Kanban MCP Remote Server..."

# Configuration
MCP_PORT=${MCP_PORT:-3001}
KANBAN_SERVER_URL=${KANBAN_SERVER_URL:-"http://localhost:5000"}
BUILD_DIR="dist"

# Create build directory
echo "📁 Creating build directory..."
mkdir -p $BUILD_DIR

# Build the remote MCP server
echo "🔨 Building remote MCP server..."
esbuild mcp-remote-server.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outfile=$BUILD_DIR/mcp-remote-server.js

# Create production environment file
echo "⚙️ Creating production environment..."
cat > $BUILD_DIR/.env << EOF
# Kanban MCP Remote Server Configuration
MCP_PORT=$MCP_PORT
KANBAN_SERVER_URL=$KANBAN_SERVER_URL
NODE_ENV=production
EOF

# Create systemd service file (optional)
if command -v systemctl &> /dev/null; then
  echo "🔧 Creating systemd service file..."
  cat > $BUILD_DIR/kanban-mcp.service << EOF
[Unit]
Description=Kanban MCP Remote Server
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=$(pwd)/$BUILD_DIR
Environment=NODE_ENV=production
EnvironmentFile=$(pwd)/$BUILD_DIR/.env
ExecStart=node mcp-remote-server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
fi

# Create Docker setup (optional)
echo "🐳 Creating Docker setup..."
cat > $BUILD_DIR/Dockerfile << EOF
FROM node:20-alpine

WORKDIR /app

# Copy built server
COPY mcp-remote-server.js .
COPY .env .

# Install production dependencies
RUN npm install express cors @modelcontextprotocol/sdk

# Expose port
EXPOSE $MCP_PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:$MCP_PORT/health || exit 1

# Start server
CMD ["node", "mcp-remote-server.js"]
EOF

cat > $BUILD_DIR/docker-compose.yml << EOF
version: '3.8'

services:
  kanban-mcp:
    build: .
    ports:
      - "$MCP_PORT:$MCP_PORT"
    environment:
      - MCP_PORT=$MCP_PORT
      - KANBAN_SERVER_URL=$KANBAN_SERVER_URL
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:$MCP_PORT/health"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF

# Create startup script
echo "🚦 Creating startup script..."
cat > $BUILD_DIR/start.sh << 'EOF'
#!/bin/bash

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

echo "🚀 Starting Kanban MCP Remote Server..."
echo "📡 MCP Port: $MCP_PORT"
echo "🎯 Kanban API: $KANBAN_SERVER_URL"

node mcp-remote-server.js
EOF

chmod +x $BUILD_DIR/start.sh

# Create test script
echo "🧪 Creating production test script..."
cat > $BUILD_DIR/test.sh << EOF
#!/bin/bash

# Test the production MCP server
MCP_URL="http://localhost:$MCP_PORT"

echo "🧪 Testing Kanban MCP Remote Server at \$MCP_URL"

# Test health check
echo "1. Health check:"
curl -s \$MCP_URL/health

echo -e "\n\n2. MCP tools list:"
curl -s -X POST \$MCP_URL/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' \\
  | head -5

echo -e "\n\n✅ Production server test complete!"
EOF

chmod +x $BUILD_DIR/test.sh

echo ""
echo "✅ Deployment preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the '$BUILD_DIR' directory to your production server"
echo "2. Install Node.js 20+ on the production server"
echo "3. Install dependencies: npm install express cors @modelcontextprotocol/sdk"
echo "4. Start the server: cd $BUILD_DIR && ./start.sh"
echo ""
echo "🔗 Server endpoints:"
echo "   Health: http://your-server:$MCP_PORT/health"
echo "   Info:   http://your-server:$MCP_PORT/info"
echo "   MCP:    http://your-server:$MCP_PORT/mcp"
echo ""
echo "🐳 Docker deployment:"
echo "   cd $BUILD_DIR && docker-compose up -d"
echo ""
echo "🔧 Systemd service:"
echo "   sudo cp $BUILD_DIR/kanban-mcp.service /etc/systemd/system/"
echo "   sudo systemctl enable kanban-mcp"
echo "   sudo systemctl start kanban-mcp"