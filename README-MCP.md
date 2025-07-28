# Kanban MCP Server

This Model Context Protocol (MCP) server provides AI agents with tools to interact with the Kanban board API.

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

#### Development Mode
```bash
tsx mcp-server.ts
```

#### Production Mode
First build it:
```bash
esbuild mcp-server.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/mcp-server.js
```

Then run:
```bash
node dist/mcp-server.js
```

### Configuration

Set the Kanban server URL if it's different from the default:
```bash
export KANBAN_SERVER_URL=http://your-kanban-server.com:5000
tsx mcp-server.ts
```

## Client Configuration

### Claude Desktop Configuration

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

### Other MCP Clients

For other MCP clients, use the stdio transport with the command:
```bash
tsx /path/to/your/project/mcp-server.ts
```

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

You can test the MCP server manually using the MCP TypeScript SDK's testing utilities, or by integrating it with an MCP client like Claude Desktop.

### Adding New Tools

To add new tools:

1. Add the tool definition to the `tools` array
2. Add a case handler in the `CallToolRequestSchema` handler
3. Update this documentation

### API Compatibility

The MCP server is built on top of the Kanban board's REST API. Any changes to the API will need corresponding updates to the MCP server.