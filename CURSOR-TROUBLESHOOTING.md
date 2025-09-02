# Cursor MCP Troubleshooting Guide

## Current Status
✅ MCP server is working correctly  
✅ All protocol methods implemented properly  
✅ 10 tools available and functional  
✅ CORS headers configured  
✅ Session management working  

## Issue
Cursor shows "loading tools" indefinitely when connecting to the MCP server.

## Verified Working
```bash
# Initialize works
curl -X POST https://kanban-flow-boneil.replit.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "cursor", "version": "1.0"}}}'

# Tools/list works  
curl -X POST https://kanban-flow-boneil.replit.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}'
```

## Troubleshooting Steps

### 1. Try Different Protocol Version
Update your Cursor config to specify protocol version:
```json
"kanban-board": {
  "url": "https://kanban-flow-boneil.replit.app/mcp",
  "type": "http",
  "protocolVersion": "2024-11-05"
}
```

### 2. Check Cursor Logs
- Look in Cursor's developer console for MCP connection errors
- Check if there are timeout or parsing errors

### 3. Try Alternative Config
```json
"kanban-board": {
  "url": "https://kanban-flow-boneil.replit.app/mcp",
  "type": "http",
  "timeout": 30000,
  "headers": {
    "User-Agent": "cursor-mcp-client/1.0"
  }
}
```

### 4. Test with Claude Desktop
Try the same server with Claude Desktop to verify it works with other MCP clients:
```json
{
  "mcpServers": {
    "kanban-board": {
      "command": "node",
      "args": ["-e", "console.log('Use HTTP transport instead')"],
      "url": "https://kanban-flow-boneil.replit.app/mcp"
    }
  }
}
```

### 5. Check Cursor MCP Implementation
The issue might be that Cursor's HTTP MCP transport has specific requirements or bugs. Try:
- Updating Cursor to latest version
- Checking Cursor's MCP documentation
- Using stdio transport instead if available

## Server Endpoints Available
- Health: `GET /mcp/health` - Server status
- Info: `GET /mcp/info` - Server and tools information  
- MCP: `POST /mcp` - Main JSON-RPC endpoint
- SSE: `GET /mcp` with `Accept: text/event-stream` - Server-sent events

## Available Tools (10 total)
1. get_projects - List all projects
2. get_cards - Get cards with filtering  
3. get_cards_by_status - Cards grouped by status
4. get_card - Get single card details
5. create_card - Create new card
6. move_card - Move card between statuses
7. update_card - Update card properties
8. delete_card - Delete a card
9. bulk_delete_cards - Delete multiple cards
10. batch_move_cards - Move multiple cards

## Next Steps
1. Check Cursor's MCP logs/console
2. Try different timeout/config settings
3. Test with other MCP clients to isolate the issue
4. Report to Cursor team if it's a client-side bug