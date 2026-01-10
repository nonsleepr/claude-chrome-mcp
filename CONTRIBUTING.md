# Contributing to Claude Chrome MCP

Thank you for your interest in contributing to Claude Chrome MCP! This document provides guidelines and information for contributors.

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to foster an inclusive and welcoming community.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- Chrome/Chromium browser
- Claude Browser Extension installed
- Git

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/claude-chrome-mcp.git
cd claude-chrome-mcp
```

2. **Install dependencies**

```bash
npm install
```

3. **Build the project**

```bash
npm run build
```

4. **Install for testing**

```bash
npm run install-native-host
```

5. **Restart Chrome** to load the native host

## Development Workflow

### Making Changes

1. **Create a feature branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes** following the code style guidelines below

3. **Build and test**

```bash
npm run build
npm run status  # Check installation
```

4. **Test manually** with your MCP client

### Code Style Guidelines

We follow strict TypeScript conventions. Please review [AGENTS.md](./AGENTS.md) for detailed guidelines. Key points:

#### TypeScript

- **Strict mode enabled** - all types must be explicit
- Use `unknown` instead of `any` where possible
- Export interfaces for public APIs
- Zod schemas for runtime validation

#### Imports

- Use ESM `import` syntax (not CommonJS `require`)
- **CRITICAL**: Import paths MUST use `.js` extension even for `.ts` files
  ```typescript
  import { ChromeMcpServer } from './server.js';  // ✓ Correct
  import { ChromeMcpServer } from './server';     // ✗ Wrong
  ```

#### Naming Conventions

- **Classes**: PascalCase - `ChromeMcpServer`
- **Interfaces**: PascalCase - `ServerOptions`
- **Functions/Methods**: camelCase - `executeTool()`
- **Variables**: camelCase - `socketPath`
- **Constants**: UPPER_SNAKE_CASE - `MAX_MESSAGE_SIZE`
- **File names**: kebab-case - `native-client.ts`

#### Formatting

- 2-space indentation
- Single quotes for strings
- Semicolons required
- Max line length: ~100 chars (preferred, not enforced)

#### Comments

- JSDoc comments for all exported functions/classes
- Inline comments for complex logic
- Section separators for logical groupings

#### Error Handling

- Use try-catch blocks for async operations
- Throw Error objects (not strings)
- Log errors to stderr: `console.error('[Component] message:', error)`
- Return error in response objects when appropriate

### Testing

Currently, the project uses manual integration testing:

1. **Build the project**: `npm run build`
2. **Install native host**: `npm run install-native-host`
3. **Restart Chrome completely**
4. **Test with an MCP client** (Claude Desktop, Cline, etc.)

Future improvements:
- Automated unit tests
- Integration test suite
- CI/CD pipeline

## Adding New Tools

To add a new browser automation tool:

1. **Define the tool** in `src/tools.ts`:

```typescript
export const myTool: ToolDefinition = {
  name: 'my_tool',
  description: 'Tool description for MCP clients',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
};
```

2. **Add to `allTools` array** at the bottom of `tools.ts`

3. **Rebuild**: `npm run build`

4. **Test** with an MCP client

Note: The actual tool execution happens in the Chrome extension. This server only registers and forwards tool requests.

## Documentation

### When to Update Documentation

- **README.md**: User-facing features, installation, usage
- **AGENTS.md**: Development guidelines, coding standards
- **docs/**: Technical specifications, protocol details
- **Code comments**: Complex logic, public APIs

### Documentation Style

- Clear and concise
- Code examples where helpful
- Mermaid diagrams for architecture
- Link to related documentation

## Pull Request Process

1. **Ensure your code follows the style guidelines**

2. **Update documentation** if needed:
   - README.md for user-facing changes
   - Code comments for implementation details
   - Technical docs for protocol changes

3. **Write a clear PR description**:
   - What problem does this solve?
   - What changes were made?
   - How to test the changes?
   - Any breaking changes?

4. **Submit the pull request** to the `main` branch

5. **Respond to review feedback** promptly

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: add support for custom port configuration
fix: resolve connection timeout issue
docs: update installation instructions
refactor: simplify error handling in native-host
test: add integration tests for tool execution
```

Prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding/updating tests
- `chore:` - Maintenance tasks

## Areas for Contribution

We welcome contributions in these areas:

### High Priority

- **Automated testing**: Unit tests, integration tests
- **Error handling improvements**: Better error messages, recovery
- **Platform support**: Windows, macOS testing and fixes
- **Documentation**: Examples, tutorials, troubleshooting guides

### Medium Priority

- **Performance optimization**: Reduce latency, memory usage
- **Logging improvements**: Structured logging, log levels
- **Configuration options**: More customization options
- **Tool enhancements**: New parameters, better validation

### Low Priority

- **Code refactoring**: Improve code organization
- **Developer tools**: Better debugging, diagnostics
- **Examples**: Sample integrations, use cases

## Questions or Issues?

- **Bug reports**: [Open an issue](https://github.com/anthropics/claude-chrome-mcp/issues)
- **Feature requests**: [Open an issue](https://github.com/anthropics/claude-chrome-mcp/issues)
- **Questions**: [GitHub Discussions](https://github.com/anthropics/claude-chrome-mcp/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to Claude Chrome MCP!
