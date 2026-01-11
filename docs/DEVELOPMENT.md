# Development Guide

This guide is for developers who want to contribute to or extend `claude-chrome-mcp`.

## Prerequisites

- Node.js 18.0.0 or later
- Chrome/Chromium browser
- [Claude Browser Extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) installed
- Git

## Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/anthropics/claude-chrome-mcp.git
cd claude-chrome-mcp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the project

```bash
npm run build
```

### 4. Install for testing

```bash
claude-chrome-mcp --install
```

### 5. Restart Chrome

Completely quit and reopen Chrome to load the native host.

## Development Workflow

### Building

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode for development (tsc --watch)
rm -rf dist/           # Clean build artifacts
```

### Testing

```bash
# Unit tests
npm test                          # Run all unit tests
npm run test:auth                 # Test authentication and CORS
npm run test:runtime              # Test runtime detection
node test/instructions.test.js    # Test server instructions

# Run a single test file
node test/<test-name>.test.js     # Run specific test
```

See [TESTING.md](./TESTING.md) for comprehensive testing documentation.

### Running the Server

```bash
npm start              # Start stdio transport
npm run start:http     # Start HTTP transport on default port
node dist/cli.js --http 3456    # Custom HTTP port
```

## Code Style Guidelines

For detailed coding standards, see [AGENTS.md](../AGENTS.md). Key points:

### TypeScript

- **Strict mode enabled** - all types must be explicit
- Use `unknown` instead of `any` where possible
- Export interfaces for public APIs
- Zod schemas for runtime validation

### Imports

- Use ESM `import` syntax (not CommonJS `require`)
- **CRITICAL**: Import paths MUST use `.js` extension even for `.ts` files
  ```typescript
  import { McpServer } from './mcp-server.js';  // ✓ Correct
  import { McpServer } from './mcp-server';     // ✗ Wrong
  ```

### Naming Conventions

- **Classes**: PascalCase - `McpServer`, `ChromeProtocol`
- **Interfaces**: PascalCase - `ServerOptions`, `ToolRequest`
- **Functions/Methods**: camelCase - `executeTool()`, `connect()`
- **Variables**: camelCase - `socketPath`, `requestTimeout`
- **Constants**: UPPER_SNAKE_CASE - `MAX_MESSAGE_SIZE`, `DEFAULT_PORT`
- **File names**: kebab-case - `mcp-server.ts`, `chrome-protocol.ts`

### Formatting

- 2-space indentation
- Single quotes for strings
- Semicolons required
- Max line length: ~100 chars (preferred, not enforced)

### Comments

- JSDoc comments for all exported functions/classes
- Inline comments for complex logic
- Section separators for logical groupings

### Error Handling

- Use try-catch blocks for async operations
- Throw Error objects (not strings)
- Log errors to stderr: `console.error('[Component] message:', error)`
- Return error in response objects when appropriate

## Adding New Tools

To add a new browser automation tool:

### 1. Define the tool in `src/tools.ts`

```typescript
export const myTool: ToolDefinition = {
  name: 'my_tool',
  description: 'Tool description for MCP clients',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
};
```

### 2. Add to `allTools` array

At the bottom of `tools.ts`:

```typescript
export const allTools: ToolDefinition[] = [
  // ... existing tools
  myTool,
];
```

### 3. Rebuild and test

```bash
npm run build
npm test
```

**Note**: The actual tool execution happens in the Chrome extension. This server only registers and forwards tool requests.

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
├── docs/                   # Documentation
└── scripts/                # Build scripts
```

## Debugging

### Check Installation Status

```bash
claude-chrome-mcp --status
```

### Monitor Native Host

The native host logs to stderr (stdout is reserved for Chrome protocol):

```bash
# View logs in Chrome extension console
# chrome://extensions → Claude extension → background page console
```

### Common Issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed debugging guides.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Pull request process
- Commit message guidelines
- Code review expectations
- Areas for contribution
