# AGENTS.md - Developer Guide for AI Agents

This document provides guidance for AI agents (like Claude) working on this codebase.

## Project Overview

**claude-chrome-mcp** is a self-contained MCP server that acts as a native messaging host for the [Claude Browser Extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn). It bridges the extension with any MCP-compatible client.

## Prerequisites

- Bun runtime (https://bun.sh)
- Chrome/Chromium browser
- [Claude Browser Extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) installed

## Build, Lint, and Test Commands

### Build Commands
```bash
bun run build          # Compile TypeScript to dist/
bun run dev            # Watch mode for development (tsc --watch)
rm -rf dist/           # Clean build artifacts
```

### Test Commands
```bash
# Unit tests
bun test                          # Run all unit tests
bun run test:auth                 # Test authentication and CORS
bun run test:runtime              # Test runtime detection
bun test/instructions.test.js     # Test server instructions

# Run a single test file
bun test/unit/<test-name>.test.js # Run specific test

# Manual integration testing (requires Chrome extension installed and configured)
```

### Installation and Start Commands
```bash
# Install globally from git
bun install -g git+https://gitea.bishop-musical.ts.net/nonsleepr/claude-chrome-mcp.git

# OR install from local clone
cd claude-chrome-mcp
bun install
bun run build
bun link

# Register native host (secure by default - auto-generates token)
claude-chrome-mcp --install

# Check installation status and view token
claude-chrome-mcp --status

# Install without authentication (local dev only)
claude-chrome-mcp --install --insecure

# Install with custom token
claude-chrome-mcp --install --auth-token "$(openssl rand -hex 32)"

# Uninstall
claude-chrome-mcp --uninstall

# After installation, the native host starts automatically when Chrome extension connects
# No need to manually run any commands - it's fully automatic
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
MCP Client → claude-chrome-mcp → Chrome Native Messaging → Chrome Extension → Browser
```

### Key Components

**1. Chrome Protocol (`src/chrome-protocol.ts`)**
- Implements Chrome native messaging protocol
- Reads/writes length-prefixed JSON on stdin/stdout
- Launched automatically by Chrome when extension connects
- Event-driven architecture using Node.js EventEmitter

**2. MCP Server (`src/mcp-server.ts`)**
- Exposes MCP tools via HTTP endpoint `/mcp`
- Handles multiple concurrent client connections
- Routes requests to Chrome extension via chrome protocol
- Manages session lifecycle and tool execution

**3. Tool Definitions (`src/tools.ts`)**
- 14 browser automation tools with Zod schemas
- MCP-compliant tool registration
- Input validation and type safety
- Maps MCP tool names to Chrome extension tools

**4. Installation (`src/install/`)**
- Creates native messaging manifest
- Generates wrapper script
- Platform-aware (Linux, macOS, Windows)
- Runtime detection (Bun vs Node.js)

**5. Constants (`src/constants.ts`)**
- Shared constants across the codebase
- Version information
- Default configuration values
- Extension and manifest identifiers

### Key Files
- **src/unified-server.ts** - MCP server (registers tools, translates protocols)
- **src/native-client.ts** - Socket client (length-prefixed JSON protocol)
- **src/tools.ts** - Tool definitions with Zod schemas (14 MCP-compatible tools)
- **src/instructions.ts** - Server instructions (delivered via MCP initialize response)
- **src/http-server.ts** - HTTP/SSE transport with session management
- **src/cli.ts** - CLI entry point (stdio/HTTP transports)
- **src/index.ts** - Package exports

### Server Instructions

The MCP server includes built-in instructions that are automatically delivered in the `initialize` response to help AI models use browser automation tools effectively.

**Location**: `src/instructions.ts` exports `SERVER_INSTRUCTIONS` constant

**Integration**: Passed to `McpServer` constructor in `unified-server.ts` via the `options.instructions` parameter

**Content Guidelines** (~600 words, comprehensive):
- Focus on **cross-tool relationships** and workflows (e.g., find → computer interaction)
- Document **operational patterns** (GIF recording, console debugging with pattern filtering)
- Specify **constraints and limitations** (60-second timeouts, alert/dialog blocking)
- Include **critical warnings** (never trigger alerts, avoid rabbit holes)
- Explain **auto-initialization** (tab groups are created automatically)
- Provide **performance tips** (batch operations, use specific selectors)

**What NOT to include**:
- ❌ Tool descriptions (already in tool schemas)
- ❌ Marketing language or superiority claims
- ❌ General behavioral instructions unrelated to tools
- ❌ Lengthy manual-style documentation

**Testing**: Unit test at `test/instructions.test.js` validates:
- Instructions exist and are comprehensive (500+ words)
- Contains all critical topics (GIF, console, alerts, tabs, timeouts, workflows)
- Includes specific best practices and warnings
- References all key tools

For more on MCP server instructions, see: https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/

## Available Tools (14 MCP-compatible)

| Tool | Description |
|------|-------------|
| `navigate` | Navigate to URLs, back/forward |
| `computer` | Click, type, scroll, screenshot, keyboard (wait action uses seconds, max 30) |
| `form_input` | Fill text inputs, select dropdowns |
| `find` | Search for elements by text (use `query` param) |
| `read_page` | Get DOM with element references |
| `get_page_text` | Extract visible text content |
| `tabs_context` | List tabs (auto-creates MCP group if needed) |
| `tabs_create` | Create new tab, optionally navigate to URL |
| `resize_window` | Resize browser window |
| `read_console_messages` | Read browser console |
| `read_network_requests` | Read network activity |
| `upload_image` | Upload image via drag-drop |
| `gif_creator` | Record actions as GIF |
| `javascript_tool` | Execute JS in page (use `text` param) |

**Note**: The MCP tab group is automatically created and managed by the extension. Clients only need to track tab IDs - the server handles group creation transparently.

## Installation Workflow

1. User runs: `claude-chrome-mcp --install`
2. Script creates:
   - Wrapper script at `~/.local/share/claude-chrome-mcp/wrapper.sh`
   - Native messaging manifest in browser's config directory
3. User restarts Chrome
4. Extension connects → Chrome launches wrapper → wrapper starts `claude-chrome-mcp`
5. Native host accepts extension connection on stdin/stdout
6. HTTP server starts on port 3456
7. MCP clients can connect

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Linux | ✅ Tested | Uses `~/.config/google-chrome/` or `chromium/` |
| macOS | ✅ Supported | Uses `~/Library/Application Support/` |
| Windows | ✅ Supported | Uses LocalAppData directory |

## Security

- HTTP server binds to `127.0.0.1` (localhost only)
- Native messaging manifest restricts to specific extension ID
- Wrapper script uses absolute paths
- No external network access required
- Optional Bearer token authentication
- Configurable CORS origins

## Message Flow Example

```
MCP Client → HTTP POST /mcp
    ↓
MCP Server (validates session, parses tool request)
    ↓
Chrome Protocol (sends tool_request via stdout)
    ↓
Chrome Extension (executes browser automation)
    ↓
Chrome Protocol (receives tool_response via stdin)
    ↓
MCP Server (formats response)
    ↓
MCP Client ← HTTP Response
```

## Error Handling

- **Timeout**: All tool operations have 60-second timeout
- **FIFO Queue**: Tool responses matched to requests in order
- **Session Cleanup**: Automatic cleanup on client disconnect
- **Port Conflicts**: Explicit error messages with resolution steps

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
3. Rebuild: `bun run build`

### Debugging Issues
- Check manifest exists: `ls -la ~/.config/chromium/NativeMessagingHosts/`
- Run unit tests: `bun test`
- Check Chrome extension console (chrome://extensions)
- Monitor native host stderr output in extension background page console

## Testing

### Unit Tests

The project uses Node.js built-in `assert` module for testing.

**Authentication & CORS Tests** (`test/unit/auth-cors.test.js`):
- Tests HTTP server middleware
- Bearer token authentication
- Custom CORS origin configuration
- OPTIONS preflight request handling

**Runtime Detection Tests** (`test/unit/runtime-detection.test.js`):
- Tests installation runtime detection (Bun vs Node.js)
- Wrapper script generation
- Installation status checking

**Instructions Tests** (`test/unit/instructions.test.js`):
- Validates server instructions content
- Ensures comprehensive coverage (500+ words)
- Checks for critical topics (GIF, console, alerts, tabs, timeouts)

### Manual Integration Testing

Manual testing is required for end-to-end tool execution with the Chrome extension.

**Setup**:
1. Build: `bun run build`
2. Install: `claude-chrome-mcp --install --auth-token "test-token"`
3. Restart Chrome completely
4. Configure MCP client with `http://localhost:3456/mcp`

**Test Checklist**:
- Basic connectivity (MCP client connects, tools listed)
- Navigation tools (navigate, tabs_create, tabs_context)
- Content tools (read_page, get_page_text, find)
- Interaction tools (computer, form_input)
- Debugging tools (read_console_messages, read_network_requests, javascript_tool)
- Media tools (gif_creator, upload_image)
- Window tools (resize_window)

## Project Structure

```
claude-chrome-mcp/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── mcp-server.ts       # MCP protocol server
│   ├── chrome-protocol.ts  # Chrome native messaging
│   ├── tools.ts            # Tool definitions
│   ├── instructions.ts     # Server instructions
│   ├── constants.ts        # Shared constants
│   ├── index.ts            # Package exports
│   └── install/            # Installation utilities
│       ├── index.ts
│       ├── runtime.ts
│       ├── wrapper.ts
│       ├── manifest.ts
│       └── paths.ts
├── test/                   # Test suite
│   └── unit/              # Unit tests
└── dist/                   # Compiled output (generated)
```

## Troubleshooting

### Build Errors
- Clean and rebuild: `rm -rf dist/ && bun run build`
- Check import paths use `.js` extension
- Verify all types are properly defined (strict mode)

### Runtime Errors
- "Connection timeout": Chrome extension not connected or native host not running
- "Tool execution failed": Check domain permissions, page state
- "Port already in use": Use `lsof -i :3456` (Linux/Mac) or `netstat -ano | findstr :3456` (Windows) to find conflicting process

### Installation Issues
- **Native host not found**: Run `claude-chrome-mcp --status` to verify installation
- **Manifest missing**: Check `~/.config/chromium/NativeMessagingHosts/` (Linux) or equivalent
- **Wrapper permissions**: Ensure `~/.local/share/claude-chrome-mcp/wrapper.sh` is executable
- **Chrome restart required**: Completely quit and reopen Chrome after installation

### Tool Execution Issues
- **Timeout (60s)**: Page may be slow or unresponsive, break into smaller operations
- **Tab not found**: Always use `tabs_context` to get valid tab IDs, never reuse across sessions
- **Element not interactable**: Use `read_page` to verify DOM structure, `find` for dynamic content

## Quick Reference for AI Agents

When working on this project:
1. ✅ Build if needed: `bun run build`
2. ✅ Test changes: `bun test`
3. ✅ Use `.js` extensions in imports (ESM requirement)
4. ✅ Follow TypeScript strict mode (explicit types)
5. ✅ Log to stderr: `console.error('[Component] message')`
6. ✅ Document with JSDoc comments
7. ✅ Native host starts automatically when Chrome extension connects

## Wire Protocol
Length-prefixed JSON: `[4 bytes length (little-endian)] [N bytes JSON (UTF-8)]`

Chrome Native Messaging protocol on stdin/stdout
