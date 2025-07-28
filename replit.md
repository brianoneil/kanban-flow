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
- **Drag & Drop**: @dnd-kit library for kanban card interactions
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API Style**: RESTful API endpoints
- **Development**: In-memory storage fallback for development

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
4. **Card Reordering**: POST /api/cards/reorder endpoint for within-column position changes
5. **Optimistic Updates**: Immediate UI updates before server confirmation for smooth UX
6. **Real-time Updates**: TanStack Query handles cache invalidation and state synchronization
7. **Error Handling**: Toast notifications for user feedback

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