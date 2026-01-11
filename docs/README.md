# Developer Documentation

Welcome to the `claude-chrome-mcp` developer documentation.

## Documentation Overview

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture, components, and wire protocols |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Development setup, workflows, and coding guidelines |
| [TESTING.md](./TESTING.md) | Testing practices, running tests, and writing new tests |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |

## Quick Links

### For Users
- [Main README](../README.md) - Installation and quick start
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Solve common issues

### For Developers
- [Development Guide](./DEVELOPMENT.md) - Setup and workflow
- [Architecture](./ARCHITECTURE.md) - Understanding the codebase
- [Testing Guide](./TESTING.md) - Running and writing tests

### For Contributors
- [Contributing Guidelines](../CONTRIBUTING.md) - How to contribute
- [AI Agent Guidelines](../AGENTS.md) - For AI assistants working on this codebase

## Project Overview

`claude-chrome-mcp` is an MCP (Model Context Protocol) server that enables browser automation through the Claude Chrome Extension. It acts as a bridge between MCP clients and the Chrome extension's browser automation tools.

### Key Features

- 14 browser automation tools (navigation, interaction, debugging)
- HTTP transport with session management
- Authentication and CORS security
- Cross-platform support (Linux, macOS, Windows)
- Bun and Node.js runtime support

### Architecture at a Glance

```
MCP Client → HTTP → MCP Server → Chrome Protocol → Chrome Extension → Browser
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed information.

## Getting Started

### 1. Read the Architecture

Start with [ARCHITECTURE.md](./ARCHITECTURE.md) to understand:
- How components interact
- Wire protocol details
- Message flow
- Security model

### 2. Set Up Development Environment

Follow [DEVELOPMENT.md](./DEVELOPMENT.md) to:
- Install prerequisites
- Build the project
- Run tests
- Install for local testing

### 3. Make Changes

- Follow coding guidelines in [AGENTS.md](../AGENTS.md)
- Write tests as described in [TESTING.md](./TESTING.md)
- Test your changes thoroughly

### 4. Contribute

- Read [CONTRIBUTING.md](../CONTRIBUTING.md)
- Submit pull requests
- Respond to reviews

## Common Tasks

### Building
```bash
npm run build     # Compile TypeScript
npm run dev       # Watch mode
```

### Testing
```bash
npm test          # Run all tests
npm run test:auth # Test authentication
```

### Installing Locally
```bash
claude-chrome-mcp --install
```

### Debugging
See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for debugging tips.

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
├── test/                   # Test suite
├── docs/                   # This documentation
└── scripts/                # Build scripts
```

## Help & Support

- **Bug Reports**: [GitHub Issues](https://github.com/anthropics/claude-chrome-mcp/issues)
- **Feature Requests**: [GitHub Issues](https://github.com/anthropics/claude-chrome-mcp/issues)
- **Questions**: [GitHub Discussions](https://github.com/anthropics/claude-chrome-mcp/discussions)

## License

MIT License - see [LICENSE](../LICENSE)
