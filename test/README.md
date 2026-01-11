# Test Suite

This directory contains automated unit tests for `claude-chrome-mcp`.

## Running Tests

```bash
# Run all tests
npm test

# Run specific tests
npm run test:auth       # Authentication and CORS tests
npm run test:runtime    # Runtime detection tests
```

## Test Structure

```
test/
├── unit/                        # Unit tests
│   ├── auth-cors.test.js       # HTTP middleware tests
│   ├── runtime-detection.test.js # Bun/Node detection
│   └── instructions.test.js    # Server instructions validation
└── README.md
```

## Available Tests

### `unit/auth-cors.test.js`

Unit tests for authentication and CORS middleware. Tests:
- Unauthenticated server allows all localhost origins
- Bearer token authentication (correct/incorrect tokens)
- Custom CORS origin configuration
- OPTIONS preflight request handling

**Requirements**: None - runs standalone without Chrome extension

### `unit/runtime-detection.test.js`

Tests for runtime detection (Bun vs Node). Tests:
- Runtime detection from environment
- Wrapper script generation with correct runtime
- Installation status checking

**Requirements**: Must run `npm run build` first

### `unit/instructions.test.js`

Tests for server instructions content validation.

**Requirements**: None

## Test Structure

Tests are self-contained Node.js scripts that:
- Use no external test framework (lightweight)
- Exit with code 0 on success, 1 on failure
- Provide colored output for readability
- Can run independently or via `npm test`

## Future Improvements

- [ ] Add test framework (e.g., Vitest, Node Test Runner)
- [ ] Add integration tests for tool execution
- [ ] Add CI/CD pipeline (GitHub Actions)
- [ ] Add code coverage reporting
- [ ] Mock Chrome extension for e2e tests

## Manual Testing

For manual integration testing with the Chrome extension:

1. Build: `npm run build`
2. Install: `claude-chrome-mcp --install`
3. Restart Chrome completely
4. Test tools via an MCP client (Claude Desktop, etc.)

See [CONTRIBUTING.md](../CONTRIBUTING.md) and [docs/TESTING.md](../docs/TESTING.md) for detailed testing guidelines.
