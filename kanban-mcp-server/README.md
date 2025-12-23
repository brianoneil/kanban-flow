# Kanban MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides AI agents with tools to interact with Kanban boards. This server enables AI assistants like Claude to manage Kanban projects, create and update cards, and organize workflows through natural language commands.

## Features

🎯 **Complete Kanban Management**
- Get all projects and cards
- Create, update, and delete cards
- Move cards between statuses (not-started, blocked, in-progress, complete, verified)
- Bulk operations for efficiency

📝 **Rich Content Support**
- Full Markdown support in card descriptions
- Task lists with automatic progress bars
- Links, code blocks, and formatting
- Image uploads to R2 storage with markdown integration
- Project organization

🔧 **Developer Friendly**
- Easy installation via npm
- Simple configuration
- Comprehensive error handling
- TypeScript support

## Installation

```bash
npm install -g kanban-mcp-server
```

## Quick Start

1. **Start your Kanban server** (must be running on localhost:3000 by default)

2. **Configure Claude Desktop** by adding to your `claude_desktop_config.json`:

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

3. **Restart Claude Desktop** and start managing your Kanban board with natural language!

## Configuration

### Environment Variables

- `KANBAN_SERVER_URL`: URL of your Kanban API server (default: `http://localhost:3000`)

### Example Configurations

**Default setup (localhost:3000):**
```json
{
  "mcpServers": {
    "kanban": {
      "command": "npx",
      "args": ["kanban-mcp-server"]
    }
  }
}
```

**Custom server URL:**
```json
{
  "mcpServers": {
    "kanban": {
      "command": "npx",
      "args": ["kanban-mcp-server"],
      "env": {
        "KANBAN_SERVER_URL": "http://your-server:8080"
      }
    }
  }
}
```

**Local development:**
```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["/path/to/kanban-mcp-server/dist/index.js"],
      "env": {
        "KANBAN_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Available Tools

### Project Management
- **`get_projects`**: Get all available projects in the system

### Image Management
- **`upload_image`**: Upload an image to R2 storage and get back a URL for use in Markdown

### Card Operations
- **`get_cards`**: Get all cards with optional filtering by project and status
- **`get_cards_by_status`**: Get cards grouped by status for better organization
- **`get_card`**: Get detailed information about a specific card
- **`create_card`**: Create a new card with Markdown description support (including images)
- **`bulk_create_cards`**: Create multiple cards in a single operation (perfect for breaking down tasks)
- **`update_card`**: Update card properties (title, description, link, status)
- **`move_card`**: Move a card to a different status with optional positioning
- **`delete_card`**: Delete a specific card

### Bulk Operations
- **`bulk_create_cards`**: Create up to 20 cards in one operation with detailed progress tracking
- **`bulk_delete_cards`**: Delete multiple cards efficiently
- **`batch_move_cards`**: Move multiple cards in a single operation

## Usage Examples

Once configured, you can use natural language with Claude to manage your Kanban board:

**Creating Cards:**
> "Create a new card called 'Implement user authentication' in the 'Backend' project with a detailed description of the requirements"

**Adding Images to Cards:**
> "Upload this screenshot and add it to a new card about the UI bug in the header component"
> 
> "Create a card documenting the new dashboard design with the mockup image I provide"

**Breaking Down Tasks:**
> "Break down the 'User Authentication System' into smaller tasks and create cards for each component: login form, password reset, JWT tokens, session management, and OAuth integration"

**Managing Workflow:**
> "Move all cards in 'in-progress' status to 'complete' and show me the current board status"

**Project Overview:**
> "Show me all cards in the 'Frontend' project grouped by status"

**Bulk Operations:**
> "Delete all completed cards from last month and create a summary of what was accomplished"

## Card Description Formatting

The server supports full Markdown formatting in card descriptions:

```markdown
## Task Overview
This card implements **user authentication** with the following features:

### Requirements
- [ ] Login form with validation
- [ ] Password reset functionality  
- [x] JWT token generation
- [ ] Session management

### Technical Details
- Use `bcrypt` for password hashing
- Implement rate limiting for login attempts
- Add [OAuth integration](https://oauth.net/) support

### Code Example
```javascript
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};
```

> **Note**: Ensure all security best practices are followed
```

Task lists (- [ ] and - [x]) automatically show progress bars on cards!

### Images in Cards

Upload images using the `upload_image` tool and include them in card descriptions:

```markdown
## Bug Report: Header Layout Issue

![Screenshot of the bug](https://your-r2-domain.r2.dev/images/123-screenshot.png)

### Description
The header component is not responsive on mobile devices...

### Steps to Reproduce
- [ ] Open the app on mobile
- [ ] Navigate to the dashboard
- [ ] Observe the broken layout

![Expected behavior](https://your-r2-domain.r2.dev/images/456-expected.png)
```

**Image Upload Workflow:**
1. Use `upload_image` tool with the full file path to the image on your local system
2. Optionally specify a width parameter for responsive sizing:
   - Pixels: `"width": "400"` → `![alt|400](url)`
   - Percentage: `"width": "50%"` → `![alt|50%](url)`
3. Receive the image URL and formatted markdown
4. Use the markdown in card descriptions
5. Images are automatically displayed inline with click-to-expand functionality

**Width Control Examples:**
```markdown
![Full size screenshot](url)              # No width specified - full responsive
![Medium screenshot|400](url)             # 400px max-width
![Small thumbnail|150](url)               # 150px max-width  
![Half width comparison|50%](url)         # 50% of container width
```

## API Requirements

Your Kanban server must provide these REST API endpoints:

- `GET /api/projects` - List all projects
- `GET /api/cards` - List all cards (supports ?project= and ?status= filters)
- `GET /api/cards/by-status` - Get cards grouped by status
- `GET /api/cards/:id` - Get specific card
- `POST /api/cards` - Create new card
- `PATCH /api/cards/:id` - Update card
- `DELETE /api/cards/:id` - Delete card
- `POST /api/cards/:id/move` - Move card to different status
- `POST /api/cards/batch-move` - Move multiple cards
- `DELETE /api/cards/bulk` - Delete multiple cards

### Expected Card Schema

```typescript
interface Card {
  id: string;
  title: string;
  description: string;
  project: string;
  link?: string;
  status: "not-started" | "blocked" | "in-progress" | "complete" | "verified";
  order: string;
  taskList?: {
    total: number;
    completed: number;
  };
}
```

## Development

### Building from Source

```bash
git clone https://github.com/yourusername/kanban-mcp-server.git
cd kanban-mcp-server
npm install
npm run build
```

### Local Development

```bash
npm run dev
```

### Testing

```bash
# Test the server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npm run dev

# Test with specific Kanban server
KANBAN_SERVER_URL=http://localhost:8080 npm run dev
```

## Troubleshooting

### Common Issues

**"Cannot connect to Kanban server"**
- Ensure your Kanban server is running
- Check the `KANBAN_SERVER_URL` environment variable
- Verify the server is accessible at the specified URL

**"Tools not showing in Claude"**
- Restart Claude Desktop after configuration changes
- Check the `claude_desktop_config.json` syntax
- Verify the server path and permissions

**"Tool calls failing"**
- Check that your Kanban API endpoints match the expected schema
- Verify authentication is disabled for MCP endpoints
- Check server logs for detailed error messages

### Debug Mode

Run with debug output:
```bash
DEBUG=1 kanban-mcp-server
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io) - The protocol specification
- [Claude Desktop](https://claude.ai/desktop) - AI assistant with MCP support
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) - TypeScript SDK for MCP

## Support

- 📖 [Documentation](https://github.com/yourusername/kanban-mcp-server/wiki)
- 🐛 [Issue Tracker](https://github.com/yourusername/kanban-mcp-server/issues)
- 💬 [Discussions](https://github.com/yourusername/kanban-mcp-server/discussions)

---

Made with ❤️ for the MCP community
