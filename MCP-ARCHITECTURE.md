# MCP Architecture Explained

## Overview

You have **TWO different MCP implementations** for the same Kanban board:

---

## 1️⃣ **Integrated MCP Server** (Built into your main app)

**Location:** `server/routes.ts` (lines 800-1500+)

**How it works:**
```
Claude Desktop → HTTP POST → http://localhost:3000/mcp
                                        ↓
                            Your Express Server (routes.ts)
                                        ↓
                            Direct database access (storage.ts)
                                        ↓
                            Immediate response
```

**Architecture:**
- **Lives inside your main Express app**
- Has `/mcp` HTTP endpoint that accepts JSON-RPC calls
- Calls `storage.ts` functions **directly** (same process)
- No network hop - instant database access
- Shares the same authentication session

**Pros:**
- ✅ Fast (no network overhead)
- ✅ Direct database access
- ✅ No extra process to manage
- ✅ Can access R2 storage directly
- ✅ Shares authentication with web app

**Cons:**
- ❌ Only works when your server is running
- ❌ Requires your full app to be deployed
- ❌ Tied to your specific deployment

**Used when:**
- You're running the full KanbanFlow app locally
- Claude Desktop config points to `http://localhost:3000`

---

## 2️⃣ **Standalone NPM Package** (Separate process)

**Location:** `kanban-mcp-server/src/index.ts`

**How it works:**
```
Claude Desktop → STDIO → kanban-mcp-server (separate Node process)
                                  ↓
                         HTTP API calls via fetch()
                                  ↓
                    http://localhost:3000/api/cards (or deployed URL)
                                  ↓
                         Your Express Server
                                  ↓
                         Database operations
```

**Architecture:**
- **Standalone Node.js process** (runs separately)
- Communicates via STDIO with Claude Desktop
- Makes HTTP API requests to your server using `fetch()`
- Acts as a **client** to your REST API
- Can connect to any deployment (local or remote)

**Pros:**
- ✅ Can be published to npm for others to use
- ✅ Can connect to remote servers (production)
- ✅ Portable - works with any Kanban API
- ✅ Standard MCP STDIO transport
- ✅ Others can use it without your code

**Cons:**
- ❌ Network overhead (HTTP requests)
- ❌ Extra process to manage
- ❌ Needs your API server running separately
- ❌ Can't access R2 directly (needs `/api/upload-image-mcp` endpoint)

**Used when:**
- Installing via `npm install kanban-mcp-server`
- Connecting to remote production server
- Others want to use your Kanban board via MCP

---

## Current Setup Comparison

| Feature | Integrated MCP | Standalone NPM |
|---------|---------------|----------------|
| **Transport** | HTTP (JSON-RPC) | STDIO |
| **Location** | Inside Express app | Separate process |
| **Database** | Direct access | Via REST API |
| **Auth** | Shared session | API calls (bypasses for now) |
| **Image Upload** | Direct R2 access | Via `/api/upload-image-mcp` |
| **Performance** | Fast (no network) | HTTP overhead |
| **Portability** | Tied to your app | Can connect anywhere |
| **Distribution** | N/A | Can publish to npm |

---

## What You Actually Need

### **Option A: Keep Both** (Recommended)
- **Integrated MCP** for local development (fast, direct access)
- **Standalone NPM** for:
  - Connecting to production from your machine
  - Sharing with others
  - Publishing to npm registry

### **Option B: Just Integrated MCP**
If you only ever use it locally and don't plan to:
- Publish to npm for others
- Connect to remote production server
- Share the MCP with other developers

Then you could **delete the `kanban-mcp-server/` directory entirely** and just use the integrated one.

### **Option C: Just Standalone NPM**
Not recommended because:
- Still need the REST API endpoints anyway
- Extra network overhead for local development
- More complex setup

---

## My Recommendation

**Keep both** because:

1. **Integrated MCP** is great for:
   - Local development
   - Fast iteration
   - Testing new features
   - Direct access to everything

2. **Standalone NPM** is great for:
   - Production access from your machine
   - Other team members/users
   - Publishing to npm
   - Documentation/examples

They serve different use cases and having both gives you flexibility!

---

## Configuration Examples

### Using Integrated MCP (Local Dev)
```json
{
  "mcpServers": {
    "kanban-local": {
      "url": "http://localhost:3000/mcp",
      "transport": {
        "type": "sse"
      }
    }
  }
}
```

### Using Standalone NPM (Any Server)
```json
{
  "mcpServers": {
    "kanban": {
      "command": "npx",
      "args": ["kanban-mcp-server"],
      "env": {
        "KANBAN_SERVER_URL": "https://kanban.lotsgoingon.com"
      }
    }
  }
}
```

---

## Current State

Both implementations are now **feature-complete** and **identical** in functionality:
- ✅ Same tools available
- ✅ Both support image uploads
- ✅ Both support Obsidian-style width syntax
- ✅ Both at version 1.2.0
- ✅ Both fully tested and working

You can use either one depending on your needs! 🚀

