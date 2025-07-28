# Kanban MCP Server

This Model Context Protocol (MCP) server provides AI agents with tools to interact with the Kanban board API. It comes in three versions:

1. **Integrated MCP Server** - Built into the main Kanban app (recommended for production)
2. **Local MCP Server** (`mcp-server.ts`) - Uses stdio transport for local Claude Desktop integration  
3. **Remote MCP Server** (`mcp-remote-server.ts`) - Standalone HTTP-based server

## Features

The MCP server exposes the following tools for AI agents:

### Card Retrieval
- **`get_cards`** - Get all cards or filter by status
- **`get_cards_by_status`** - Get cards grouped by status with proper ordering
- **`get_card`** - Get details of a specific card by ID

### Card Management
- **`create_card`** - Create a new card with title, description, link, and status
- **`update_card`** - Update properties of an existing card
- **`delete_card`** - Delete a card from the board

### Card Movement
- **`move_card`** - Move a card to a different status and position
- **`batch_move_cards`** - Move multiple cards in a single operation

## Setup

### Prerequisites
- Node.js 18+ 
- The Kanban board server running (default: http://localhost:5000)

### Installation

1. Install dependencies (already done if you're in the project):
```bash
npm install @modelcontextprotocol/sdk
```

2. Make the MCP server executable:
```bash
chmod +x mcp-server.ts
```

### Running the MCP Server

#### Integrated MCP Server (Recommended)

The MCP server is now built directly into the main Kanban application for seamless deployment:

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```

**MCP Endpoints (same host as main app):**
- Health check: `http://your-app.com:5000/mcp/health`
- Server info: `http://your-app.com:5000/mcp/info`
- MCP endpoint: `http://your-app.com:5000/mcp`

**Testing:**
```bash
tsx test-mcp-integrated.ts
```

#### Local MCP Server (stdio transport)

**Development Mode:**
```bash
tsx mcp-server.ts
```

**Production Mode:**
```bash
# Build first
esbuild mcp-server.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/mcp-server.js

# Run
node dist/mcp-server.js
```

#### Remote MCP Server (HTTP transport)

**Development Mode:**
```bash
tsx mcp-remote-server.ts
```

**Production Mode:**
```bash
# Build first
esbuild mcp-remote-server.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/mcp-remote-server.js

# Run
node dist/mcp-remote-server.js
```

**Environment Variables:**
```bash
# Port for the MCP remote server (default: 3001)
export MCP_PORT=3001

# Kanban server URL (default: http://localhost:5000)
export KANBAN_SERVER_URL=http://your-kanban-server.com:5000

# Start the remote server
tsx mcp-remote-server.ts
```

**Remote Server Endpoints:**
- Health check: `http://localhost:3001/health`
- Server info: `http://localhost:3001/info`
- MCP endpoint: `http://localhost:3001/mcp`

## Client Configuration

### Local MCP Server (Claude Desktop)

Add this to your Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "kanban": {
      "command": "tsx",
      "args": ["/path/to/your/project/mcp-server.ts"],
      "env": {
        "KANBAN_SERVER_URL": "http://localhost:5000"
      }
    }
  }
}
```

### Integrated MCP Server

For production deployments, use the integrated MCP server that runs with your main app:

**MCP Client Configuration:**
```json
{
  "mcpServers": {
    "kanban": {
      "url": "http://your-kanban-app.com:5000/mcp",
      "type": "http"
    }
  }
}
```

**Testing the Integrated Server:**
```bash
# Test all endpoints and tools (main app must be running)
tsx test-mcp-integrated.ts

# Or test specific endpoints
curl http://localhost:5000/mcp/health
curl http://localhost:5000/mcp/info
```

### Remote MCP Server (Alternative)

For separate deployment, use the standalone HTTP-based remote server:

**MCP Client Configuration:**
```json
{
  "mcpServers": {
    "kanban-remote": {
      "url": "http://your-mcp-server.com:3001/mcp", 
      "type": "http"
    }
  }
}
```

**Testing the Remote Server:**
```bash
# Test all endpoints and tools
tsx test-mcp-remote.ts

# Or test specific endpoint
curl http://localhost:3001/health
curl http://localhost:3001/info
```

### Other MCP Clients

- **Integrated (HTTP):** Connect to `http://your-app:5000/mcp` using HTTP transport (recommended)
- **Local (stdio):** `tsx /path/to/your/project/mcp-server.ts`  
- **Remote (HTTP):** Connect to `http://your-server:3001/mcp` using HTTP transport

## Tool Examples

### Get All Cards
```typescript
// Tool: get_cards
// Arguments: {}
// Returns: Array of all cards
```

### Filter Cards by Status
```typescript
// Tool: get_cards
// Arguments: { "status": "in-progress" }
// Returns: Array of cards with in-progress status
```

### Create a New Card
```typescript
// Tool: create_card
// Arguments: {
//   "title": "New Feature",
//   "description": "Implement new feature X",
//   "link": "https://github.com/repo/issues/123",
//   "status": "not-started"
// }
```

### Move a Card
```typescript
// Tool: move_card
// Arguments: {
//   "id": "card-123",
//   "status": "in-progress",
//   "position": 0
// }
```

### Batch Move Cards
```typescript
// Tool: batch_move_cards
// Arguments: {
//   "operations": [
//     { "cardId": "card-1", "status": "complete" },
//     { "cardId": "card-2", "status": "in-progress", "position": 0 }
//   ]
// }
```

## Status Values

The Kanban board supports these status values:
- `not-started` - Tasks that haven't been started yet
- `blocked` - Tasks that are blocked by dependencies
- `in-progress` - Tasks currently being worked on
- `complete` - Finished tasks awaiting verification
- `verified` - Tasks that have been completed and verified

## Error Handling

The MCP server includes comprehensive error handling:
- Network errors are caught and reported
- API validation errors are passed through
- Invalid tool arguments are validated by the MCP framework
- Detailed error messages help with debugging

## Real-time Updates

The Kanban board includes WebSocket support for real-time updates. When cards are moved through the MCP server, all connected clients (including the web interface) will see the changes immediately with smooth animations.

## Development

### Testing the MCP Server

You can test the MCP servers using the provided test scripts:

- **Integrated Server:** `tsx test-mcp-integrated.ts` (tests endpoints at localhost:5000/mcp)
- **Remote Server:** `tsx test-mcp-remote.ts` (tests standalone server at localhost:3001/mcp)
- **Local Server:** Integrate with MCP clients like Claude Desktop using stdio transport

### Adding New Tools

To add new tools:

1. Add the tool definition to the `tools` array
2. Add a case handler in the `CallToolRequestSchema` handler
3. Update this documentation

### API Compatibility

The MCP server is built on top of the Kanban board's REST API. Any changes to the API will need corresponding updates to the MCP server.