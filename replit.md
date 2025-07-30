# Kanban Board Application

## Overview

This is a full-stack Kanban board application built with React (TypeScript) on the frontend and Express.js on the backend. The application allows users to manage tasks through a smooth drag-and-drop interface with different status columns (not-started, blocked, in-progress, complete, verified). Features advanced drag-and-drop with card insertion, reordering, and optimistic updates for seamless user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript and Vite for development/build tooling
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Drag & Drop**: @dnd-kit library with Framer Motion for smooth animations
- **Real-time**: WebSocket client with automatic reconnection
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (migrated from in-memory storage)
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API Style**: RESTful API endpoints with comprehensive CRUD operations
- **Real-time**: WebSocket server broadcasting live updates
- **Production-Ready**: Full database persistence with proper schema management

### MCP Integration
- **Integrated MCP Server**: Model Context Protocol endpoints built into main application (recommended)
- **Local MCP Server**: stdio transport version for Claude Desktop integration  
- **Remote MCP Server**: Standalone HTTP-based server for separate deployment
- **SDK**: @modelcontextprotocol/sdk for TypeScript implementation
- **Tools**: 8 comprehensive tools for card management and movement
- **Endpoints**: `/mcp/health`, `/mcp/info`, `/mcp` (JSON-RPC 2.0 protocol)
- **Real-time**: MCP actions trigger WebSocket broadcasts for live updates

## Key Components

### Database Schema
- **Cards Table**: Stores kanban cards with id, title, description, link, and status fields
- **Users Table**: Basic user structure (id, username, password) - appears to be prepared for future authentication
- **Status Types**: Predefined kanban statuses (not-started, blocked, in-progress, complete, verified)

### Frontend Components
- **KanbanBoard**: Main board component managing drag-and-drop functionality
- **KanbanColumn**: Individual columns for each status type
- **TaskCard**: Individual card components with drag capabilities
- **AddCardDialog**: Modal form for creating new cards
- **UI Components**: Comprehensive shadcn/ui component library

### Backend Components
- **Storage Layer**: Abstracted storage interface with in-memory implementation
- **Routes**: RESTful endpoints for CRUD operations on cards
- **Validation**: Zod schemas shared between frontend and backend

## Data Flow

1. **Card Retrieval**: Frontend fetches cards via GET /api/cards, sorted by order within columns
2. **Card Creation**: Forms submit to POST /api/cards with validation
3. **Card Updates**: Drag-and-drop triggers PATCH /api/cards/:id for status/order changes
4. **Card Movement**: POST /api/cards/:id/move endpoint with automatic position calculation
5. **Batch Operations**: POST /api/cards/batch-move for efficient multi-card movements
6. **Optimistic Updates**: Immediate UI updates before server confirmation for smooth UX
7. **Real-time Updates**: WebSocket broadcasts changes to all connected clients
8. **Animation System**: Framer Motion LayoutGroup enables smooth cross-column animations
9. **MCP Integration**: AI agents can perform all operations via local or remote MCP tools
10. **Remote API**: HTTP-based MCP server for production agent integration
11. **Error Handling**: Toast notifications for user feedback

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **@dnd-kit/***: Drag and drop functionality
- **@radix-ui/***: Accessible UI primitives
- **react-hook-form**: Form state management
- **zod**: Runtime type validation

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type safety across the stack
- **Tailwind CSS**: Utility-first styling
- **ESBuild**: Production bundling

## Deployment Strategy

The application is configured for deployment with:

- **Build Process**: Vite builds the frontend to `dist/public`, ESBuild bundles the backend to `dist/index.js`
- **Environment Variables**: `DATABASE_URL` required for PostgreSQL connection
- **Production Mode**: Serves static files from Express in production
- **Development Mode**: Vite dev server with HMR and proxy setup

The architecture supports both development (with in-memory storage) and production (with PostgreSQL) environments, with the storage layer abstracted to allow easy switching between implementations.

## Recent Changes

### July 30, 2025
- **Cards Summary View**: Added floating summary component with card titles and status counts, real-time updates, and markdown export
- **Summary API Endpoints**: GET /api/cards/summary (JSON) and /api/cards/summary/markdown for external access
- **Real-time Summary Updates**: Summary automatically refreshes via WebSocket when cards change
- **Draggable Summary Card**: Made summary component draggable with move handle and improved text contrast for better readability
- **Data Consistency Fix**: Fixed status mismatch where cards had "completed" status but frontend expected "complete"
- **Bulk Delete API & MCP Tool**: Added efficient bulk card deletion via DELETE /api/cards/bulk endpoint and bulk_delete_cards MCP tool
- **Enhanced MCP Capabilities**: MCP now supports deleting multiple cards by ID array for better automation efficiency
- **Real-time Bulk Updates**: Bulk deletions broadcast CARDS_BULK_DELETED events to update all connected clients
- **Full-Screen Card View**: Added comprehensive view mode with large dialog showing complete card details in readable format
- **Enhanced Card Actions**: Cards now show view (purple eye), edit (green pencil), copy (blue copy), and delete buttons on hover
- **Rich Content Display**: View dialog uses proper Markdown rendering with enhanced typography and formatting
- **Integrated Actions**: View dialog includes quick access to edit, copy, and external link functionality
- **Card Editing**: Added comprehensive card editing functionality with dialog form supporting title, description, link, and status changes
- **Clipboard Copy**: Added one-click copy functionality to export card content as Markdown format
- **Visual Feedback**: Copy button shows checkmark confirmation and toast notification when successful
- **Column Width Persistence**: Added localStorage persistence for column widths - resized columns now remember their width when you reload the page
- **Column Width Reset**: Added reset button (rotate icon) in header to restore all columns to default 320px width
- **Enhanced UX**: Column width changes are automatically saved and restored across browser sessions
- **Improved Controls**: New visual indicator for column width reset functionality with toast notifications

### July 29, 2025
- **Enhanced Card Design**: Added expandable/collapsible card views with smooth animations
- **Markdown Support**: Full Markdown formatting support in card descriptions using react-markdown
- **MCP Markdown Integration**: Updated MCP tools to encourage agents to use Markdown formatting
- **Improved Card Layout**: Cards now use proper flex layouts, titles never get cropped, and long descriptions show expand/collapse buttons
- **Real-time Updates**: Fixed WebSocket broadcasting for database operations to ensure live UI updates
- **Create Project UI**: Added project creation functionality with automatic URL navigation
- **Dark Mode Implementation**: Comprehensive dark theme with theme provider, localStorage persistence, and smooth transitions
- **Resizable Columns**: Added column resize functionality with drag handles (280px-600px range)
- **Responsive Layout**: Horizontal scrolling container prevents column overlap on narrow screens
- **Theme Toggle**: Positioned in top-right header with sun/moon icon animations

### July 28, 2025
- **Integrated MCP Server**: Built MCP endpoints directly into main application for single deployment
- **Triple MCP Architecture**: Now supports integrated (recommended), local (stdio), and remote (HTTP) MCP
- **Production Optimized**: Integrated server shares same port and infrastructure as main app
- **Comprehensive Testing**: Added test suites for all MCP server variants
- **Real-time MCP**: MCP operations trigger WebSocket broadcasts for live UI updates
- **Multi-Project Support**: Added project property to cards for organizing different boards by project
- **Project Filtering**: API endpoints now support project-based filtering with GET /api/projects
- **Enhanced UI**: Project selector in kanban board header with formatted project names
- **Sample Data**: Three demo projects (E-commerce Platform, Mobile App, Marketing Website)
- **MCP Project Integration**: Updated all 9 MCP tools to support project filtering and management
- **Enhanced MCP Tools**: New get_projects tool, project parameters in get_cards/get_cards_by_status/create_card
- **Comprehensive Testing**: Verified project-based MCP functionality with test suite