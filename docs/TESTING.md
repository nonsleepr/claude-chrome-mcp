# Testing Guide

This guide covers testing practices for `claude-chrome-mcp`.

## Overview

The project uses a mix of automated unit tests and manual integration testing.

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Suites

```bash
npm run test:auth       # Authentication and CORS tests
npm run test:runtime    # Runtime detection tests
node test/instructions.test.js  # Server instructions tests
```

### Individual Tests

```bash
node test/auth-cors.test.js
node test/runtime-detection.test.js
node test/instructions.test.js
```

## Test Structure

Tests are organized in the `test/` directory:

```
test/
├── unit/
│   ├── auth-cors.test.js        # HTTP middleware tests
│   ├── runtime-detection.test.js # Bun/Node detection
│   └── instructions.test.js      # Server instructions validation
└── README.md
```

## Unit Tests

### Authentication & CORS Tests (`test/unit/auth-cors.test.js`)

Tests HTTP server middleware:

- ✅ Unauthenticated server allows all localhost origins
- ✅ Bearer token authentication (correct/incorrect tokens)
- ✅ Custom CORS origin configuration
- ✅ OPTIONS preflight request handling
- ✅ Authentication bypass for OPTIONS requests

**Requirements**: None - runs standalone without Chrome extension

**Run**:
```bash
npm run test:auth
```

### Runtime Detection Tests (`test/unit/runtime-detection.test.js`)

Tests installation runtime detection:

- ✅ Detects Bun from npm_config_user_agent
- ✅ Falls back to Node.js when Bun not available
- ✅ Wrapper script generation with correct runtime path
- ✅ Installation status checking

**Requirements**: Must run `npm run build` first

**Run**:
```bash
npm run test:runtime
```

### Instructions Tests (`test/unit/instructions.test.js`)

Tests server instructions content:

- ✅ Instructions exist and are comprehensive (500+ words)
- ✅ Contains all critical topics (GIF, console, alerts, tabs, timeouts)
- ✅ Includes specific best practices and warnings
- ✅ References all key tools

**Requirements**: None

**Run**:
```bash
node test/instructions.test.js
```

## Manual Integration Testing

Manual testing is required for end-to-end tool execution with the Chrome extension.

### Setup

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Install native host**:
   ```bash
   claude-chrome-mcp --install --auth-token "test-token"
   ```

3. **Restart Chrome completely**:
   - Quit Chrome (not just close windows)
   - Reopen Chrome

4. **Configure MCP client** (e.g., Claude Desktop):
   ```json
   {
     "mcpServers": {
       "claude_chrome_test": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "http://localhost:3456/mcp"],
         "env": {
           "MCP_REMOTE_HEADERS": "{\"Authorization\": \"Bearer test-token\"}"
         }
       }
     }
   }
   ```

### Test Checklist

#### Basic Connectivity
- [ ] MCP client connects successfully
- [ ] Tools are listed in client
- [ ] Extension shows connected status

#### Navigation Tools
- [ ] `navigate` - Load a webpage
- [ ] `navigate` - Back/forward navigation
- [ ] `tabs_create` - Create new tab
- [ ] `tabs_create` with URL - Create and navigate
- [ ] `tabs_context` - List available tabs

#### Content Tools
- [ ] `read_page` - Get DOM structure
- [ ] `get_page_text` - Extract visible text
- [ ] `find` - Search for elements by text

#### Interaction Tools
- [ ] `computer` - Screenshot
- [ ] `computer` - Click element
- [ ] `computer` - Type text
- [ ] `computer` - Scroll page
- [ ] `computer` - Wait
- [ ] `form_input` - Fill text input
- [ ] `form_input` - Select dropdown

#### Debugging Tools
- [ ] `read_console_messages` - Read console output
- [ ] `read_console_messages` with pattern filter
- [ ] `read_network_requests` - Read network activity
- [ ] `javascript_tool` - Execute JavaScript

#### Media Tools
- [ ] `gif_creator` - Record workflow as GIF
- [ ] `upload_image` - Upload image via drag-drop

#### Window Tools
- [ ] `resize_window` - Resize browser window

### Common Test Scenarios

#### Scenario 1: Complete Workflow
```
1. Create new tab with URL
2. Read page content
3. Find login button
4. Click button
5. Fill form inputs
6. Submit form
7. Verify success page
```

#### Scenario 2: Multi-Tab Operation
```
1. Create tab A, navigate to page 1
2. Create tab B, navigate to page 2
3. Switch between tabs
4. Verify tab context
```

#### Scenario 3: Error Recovery
```
1. Create tab
2. Try invalid operation
3. Verify error message
4. Retry with correct operation
5. Verify success
```

## Writing New Tests

### Test Framework

Tests use Node.js built-in `assert` module (no external test framework).

### Test Template

```javascript
import assert from 'assert';

console.log('Testing [feature name]...');

try {
  // Test setup
  const result = await testFunction();
  
  // Assertions
  assert.strictEqual(result.expected, result.actual);
  
  console.log('✅ Test passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
```

### Test Best Practices

1. **Keep tests focused**: One feature per test file
2. **Use descriptive names**: Test file name should describe what's being tested
3. **Clean up resources**: Close connections, clear state
4. **Exit with code**: 0 for success, 1 for failure
5. **Provide clear output**: Use colored output (✅ ❌) for readability

### Adding a New Unit Test

1. **Create test file** in `test/unit/`:
   ```bash
   touch test/unit/my-feature.test.js
   ```

2. **Write test**:
   ```javascript
   // test/unit/my-feature.test.js
   import assert from 'assert';
   import { myFeature } from '../../dist/my-module.js';
   
   console.log('Testing my feature...');
   
   // Test code here
   
   console.log('✅ All tests passed');
   ```

3. **Add to npm scripts** in `package.json`:
   ```json
   {
     "scripts": {
       "test:myfeature": "node test/unit/my-feature.test.js"
     }
   }
   ```

4. **Add to main test script**:
   Update `test:unit` script to include new test.

## Future Improvements

### Planned Test Enhancements

- [ ] **Test Framework**: Migrate to Vitest or Node Test Runner
- [ ] **Code Coverage**: Add coverage reporting with c8/nyc
- [ ] **Integration Tests**: Mock Chrome extension for automated e2e tests
- [ ] **CI/CD Pipeline**: GitHub Actions for automated testing
- [ ] **Performance Tests**: Benchmark tool execution times
- [ ] **Stress Tests**: Test with many concurrent clients
- [ ] **Browser Compatibility**: Test across Chrome versions

### Mock Extension

Create a mock Chrome extension for automated testing:

```javascript
// test/mocks/chrome-extension.js
// Simulates Chrome extension responses
class MockChromeExtension {
  sendToolResponse(result) {
    // Send mock response via stdio
  }
}
```

This would enable:
- Automated tool execution tests
- Response format validation
- Error handling verification
- Performance benchmarking

## Debugging Tests

### Test Fails to Import Module

**Error**: `Cannot find module`

**Solution**:
```bash
# Ensure project is built
npm run build

# Check dist/ directory exists
ls -la dist/
```

### Test Hangs

**Cause**: Async operation not resolving

**Solution**:
- Add timeout to async operations
- Check for unhandled promises
- Verify cleanup code runs

### Test Flaky

**Causes**:
- Race conditions
- Network timing
- Resource cleanup issues

**Solutions**:
- Add explicit waits
- Mock external dependencies
- Ensure proper cleanup

## Contributing Tests

When contributing, please:

1. **Add tests for new features**
2. **Update existing tests** if behavior changes
3. **Ensure all tests pass** before submitting PR
4. **Document test requirements** (e.g., "requires Chrome running")
5. **Follow existing test patterns**

See [CONTRIBUTING.md](../CONTRIBUTING.md) for more details.
