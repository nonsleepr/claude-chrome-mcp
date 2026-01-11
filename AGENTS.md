# AGENTS.md - Developer Guide for AI Agents

This document provides guidance for AI agents (like Claude) working on this codebase.

## Project Overview

**claude-chrome-mcp** is an MCP (Model Context Protocol) server adapter that bridges the Claude Browser Extension with any MCP-compatible client. It translates MCP protocol messages to the native host socket protocol used by the Chrome extension.

## Build, Lint, and Test Commands

### Build Commands
```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode for development (tsc --watch)
rm -rf dist/           # Clean build artifacts
```

### Test Commands
```bash
# Unit tests
npm test                      # Run all unit tests
npm run test:auth             # Test authentication and CORS
npm run test:runtime          # Test runtime detection

# Manual integration testing (requires Chrome extension)
# See CONTRIBUTING.md for manual testing instructions
```

### Start Commands
```bash
npm start              # Start stdio transport
npm run start:http     # Start HTTP transport on default port
node dist/cli.js --http 3456    # Custom HTTP port
node dist/cli.js --spawn        # Auto-spawn native host
```

## Code Style Guidelines

### Imports
- Use ESM `import` syntax (not CommonJS `require`)
- Import statements at top of file, grouped by category
- External packages first, then internal modules
- **CRITICAL**: Import paths MUST use `.js` extension even for `.ts` files
  ```typescript
  import { ChromeMcpServer } from './server.js';  // ✓ Correct
  import { ChromeMcpServer } from './server';     // ✗ Wrong
  ```
- Use named imports for clarity: `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'`
- Use namespace imports for Node.js modules: `import * as net from 'net'`

### Formatting
- 2-space indentation (configured in TypeScript compiler)
- Single quotes for strings (except JSDoc/comments)
- Semicolons required at end of statements
- Blank line between logical sections
- Max line length: ~100 chars (not enforced, but preferred)

### Types
- **Strict TypeScript mode enabled** - all types must be explicit
- Export interfaces for public APIs: `export interface ServerOptions`
- Use `unknown` instead of `any` where possible
- Type aliases for complex types: `type McpContent = TextContent | ImageContent`
- Zod schemas for runtime validation: `z.object({ name: z.string() })`
- Generic types where appropriate: `Map<number, PendingRequest>`

### Naming Conventions
- **Classes**: PascalCase - `ChromeMcpServer`, `NativeHostClient`
- **Interfaces**: PascalCase - `ServerOptions`, `ToolRequest`, `ToolResponse`
- **Functions/Methods**: camelCase - `connect()`, `executeTool()`, `registerTools()`
- **Variables**: camelCase - `socketPath`, `requestTimeout`, `nativeClient`
- **Constants**: UPPER_SNAKE_CASE - `MAX_MESSAGE_SIZE`
- **Private members**: prefix with `private` - `private socket: net.Socket`
- **File names**: kebab-case - `native-client.ts`, `http-server.ts`

### Comments and Documentation
- JSDoc comments for all exported functions/classes
- Multi-line JSDoc format:
  ```typescript
  /**
   * Execute a tool via the native host
   */
  async executeTool(name: string): Promise<ToolResult> { }
  ```
- Inline comments for complex logic
- Section separators in tools.ts use comment blocks with `=` characters

### Error Handling
- Use try-catch blocks for async operations
- Throw Error objects (not strings): `throw new Error('descriptive message')`
- Log errors to stderr: `console.error('[Component] Error message:', error)`
- Return error in response objects when appropriate:
  ```typescript
  return { content: [{ type: 'text', text: `Error: ${message}` }] };
  ```
- Handle socket errors with event listeners
- Timeout handling for long-running operations (default 30-60s)

### Async/Await
- Always use `async/await` (not `.then()/.catch()`)
- Properly await all async operations
- Use `Promise<void>` return type for async functions that don't return values
- Handle cleanup in `finally` blocks when needed

### Classes and Methods
- Constructor initializes all required fields
- Private methods for internal logic
- Public methods for API surface
- Method ordering: constructor, public methods, private methods
- Use `this.` for member access

### Module Structure
- Each file has a header comment explaining its purpose
- Export interfaces and types before classes
- Export constants before functions
- Default export not used - always named exports

## Architecture

```
MCP Client → claude-chrome-mcp → Native Host Socket → Chrome Extension → Browser
```

### Key Files
- **src/server.ts** - MCP server (registers tools, translates protocols)
- **src/native-client.ts** - Socket client (length-prefixed JSON protocol)
- **src/tools.ts** - Tool definitions with Zod schemas (14 MCP-compatible tools)
- **src/http-server.ts** - HTTP/SSE transport with session management
- **src/cli.ts** - CLI entry point (stdio/HTTP transports)
- **src/index.ts** - Package exports

## Available Tools (14 MCP-compatible)

| Tool | Description |
|------|-------------|
| `navigate` | Navigate to URLs, back/forward |
| `computer` | Click, type, scroll, screenshot, keyboard (wait action uses seconds, max 30) |
| `form_input` | Fill text inputs, select dropdowns |
| `find` | Search for elements by text (use `query` param) |
| `read_page` | Get DOM with element references |
| `get_page_text` | Extract visible text content |
| `tabs_context` | List tabs in browser tab group (auto-creates if needed) |
| `tabs_create` | Create new tab with optional URL (navigates automatically if URL provided) |
| `resize_window` | Resize browser window |
| `read_console_messages` | Read browser console |
| `read_network_requests` | Read network activity |
| `upload_image` | Upload image via drag-drop |
| `gif_creator` | Record actions as GIF |
| `javascript_tool` | Execute JS in page (use `text` param) |

**Note**: Tab group initialization is automatic - no need to call `tabs_context` explicitly before using other tools.

## Testing Prerequisites

### CRITICAL: Start Native Host First
```bash
# In separate terminal, keep running:
claude --chrome-native-host

# Expected output:
# [Claude Chrome Native Host] Creating socket listener: /tmp/claude-mcp-browser-bridge-<username>
# [Claude Chrome Native Host] Socket server listening for connections
```

## Common Development Tasks

### Adding a New Tool
1. Add tool definition to `src/tools.ts`:
   ```typescript
   export const myTool: ToolDefinition = {
     name: 'my_tool',
     description: 'Tool description',
     inputSchema: z.object({
       param: z.string().describe('Parameter description'),
     }),
   };
   ```
2. Add to `allTools` array at bottom of `tools.ts`
3. Rebuild: `npm run build`

### Debugging Issues
- Check socket exists: `ls -la /tmp/claude-mcp-browser-bridge-*`
- Run unit tests: `npm test`
- Monitor native host stderr output
- Check Chrome extension console (chrome://extensions)

## Troubleshooting

### Build Errors
- Clean and rebuild: `rm -rf dist/ && npm run build`
- Check import paths use `.js` extension
- Verify all types are properly defined (strict mode)

### Runtime Errors
- "Socket not found": Native host not running
- "Connection timeout": Chrome extension not connected
- "Tool execution failed": Check domain permissions, page state

## Quick Reference for AI Agents

When working on this project:
1. ✅ Start native host: `claude --chrome-native-host`
2. ✅ Build if needed: `npm run build`
3. ✅ Test changes: `npm test`
4. ✅ Use `.js` extensions in imports (ESM requirement)
5. ✅ Follow TypeScript strict mode (explicit types)
6. ✅ Log to stderr: `console.error('[Component] message')`
7. ✅ Document with JSDoc comments

## Wire Protocol
Length-prefixed JSON: `[4 bytes length (little-endian)] [N bytes JSON (UTF-8)]`

Socket path: `/tmp/claude-mcp-browser-bridge-{username}`
