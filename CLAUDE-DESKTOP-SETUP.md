# Claude Desktop MCP Setup for Kanban Board

This guide will help you connect Claude Desktop to your Kanban board using the integrated MCP server.

## Prerequisites

1. **Claude Desktop** installed on your computer
2. **Kanban board deployed** at: `https://kanban-flow-boneil.replit.app`

## Step 1: Locate Claude Desktop Configuration

Find your Claude Desktop configuration file:

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

## Step 2: Add Kanban MCP Server

Open the configuration file and add the Kanban MCP server. 

**Method 1: HTTP Transport (Recommended for Remote Servers)**
```json
{
  "mcpServers": {
    "kanban-board": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-http", "https://kanban-flow-boneil.replit.app/mcp"]
    }
  }
}
```

**Method 2: Direct HTTP Configuration**
```json
{
  "mcpServers": {
    "kanban-board": {
      "command": "node",
      "args": ["-e", "console.log('HTTP MCP Server')"],
      "transport": {
        "type": "http",
        "url": "https://kanban-flow-boneil.replit.app/mcp"
      }
    }
  }
}
```

**Method 3: Simple Configuration (if supported)**
```json
{
  "mcpServers": {
    "kanban-board": {
      "url": "https://kanban-flow-boneil.replit.app/mcp",
      "type": "http"
    }
  }
}
```

## Step 3: Restart Claude Desktop

1. Close Claude Desktop completely
2. Reopen Claude Desktop
3. The Kanban tools should now be available

## Step 4: Verify Connection

In Claude Desktop, try asking:

> "What tools do you have available for the kanban board?"

You should see 8 available tools:
- `get_cards` - Get all cards or filter by status
- `get_cards_by_status` - Get cards grouped by status  
- `get_card` - Get details of a specific card
- `create_card` - Create a new card
- `move_card` - Move a card to different status
- `update_card` - Update card properties
- `delete_card` - Delete a card
- `batch_move_cards` - Move multiple cards at once

## Example Commands

Try these commands in Claude Desktop:

**View all cards:**
> "Show me all the cards on the kanban board"

**Create a new card:**
> "Create a new card called 'Test Feature' with description 'Testing MCP integration' in the not-started column"

**Move a card:**
> "Move the 'Test Feature' card to in-progress status"

**Get cards by status:**
> "Show me all cards grouped by their status"

## Troubleshooting

### Issue: Claude says no tools are available

**Solution 1: Use the HTTP proxy configuration (Most Reliable)**
Try this configuration which uses the official MCP HTTP proxy:
```json
{
  "mcpServers": {
    "kanban-board": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-http", "https://kanban-flow-boneil.replit.app/mcp"]
    }
  }
}
```

**Solution 2: Alternative transport configuration**
If the above doesn't work, try the transport format:
```json
{
  "mcpServers": {
    "kanban-board": {
      "command": "node",
      "args": ["-e", "console.log('HTTP transport')"],
      "transport": {
        "type": "http", 
        "url": "https://kanban-flow-boneil.replit.app/mcp"
      }
    }
  }
}
```

**Solution 2: Check configuration file**
- Ensure the JSON syntax is correct (no trailing commas)
- Verify the URL is exactly: `https://kanban-flow-boneil.replit.app/mcp`
- Make sure the file is saved properly

**Solution 3: Restart Claude Desktop properly**
- Completely quit Claude Desktop (check Activity Monitor/Task Manager)
- Wait 10 seconds
- Reopen Claude Desktop
- Wait for it to fully load before testing

**Solution 4: Test the MCP endpoint manually**
Run this in terminal/command prompt:
```bash
curl -X POST https://kanban-flow-boneil.replit.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}'
```

You should see a JSON response with server info.

### Issue: Connection timeout or network error

**Check:**
- Your internet connection
- That the Kanban app is deployed and accessible
- Try visiting: https://kanban-flow-boneil.replit.app/mcp/health

### Issue: Tools appear but don't work

**Try:**
- Ask Claude to use a specific tool: "Use the get_cards tool to show me all cards"
- Check if there are any error messages in Claude's responses

## Success! 

Once connected, you can:
- Ask Claude to manage your Kanban board naturally
- Create, move, and update cards through conversation
- Get board status and analytics
- Perform batch operations efficiently

The MCP integration makes Claude a powerful assistant for project management through your Kanban board!