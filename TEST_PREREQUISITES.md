# MCP Features Test - Prerequisites

Before running the comprehensive test suite (`test-mcp-features.js`), ensure:

## 1. Chrome/Chromium is Running
```bash
# Check if Chrome is running
ps aux | grep -i chrome | grep -v grep
```

## 2. Extension is Loaded
- Open `chromium://extensions/` or `chrome://extensions/`
- Find "Claude (Custom)" extension
- Ensure it's **enabled** (toggle is ON/blue)
- Click **reload** button if you just installed or updated it

## 3. At Least One Tab is Open
- Open a new tab
- Navigate to any website (e.g., https://example.com)
- **Do not use chrome:// or about: URLs** - they don't allow extensions

## 4. Native Host Connection
The test suite will automatically spawn the native host, but you can manually verify:

```bash
# Check if native host socket exists and is listening
ls -la /tmp/claude-mcp-browser-bridge-*

# Test socket connectivity (should show "Connected" if Chrome extension is active)
node test-chrome-native-messaging.js
```

## Running the Tests

```bash
# Interactive mode (will prompt before starting)
node test-mcp-features.js

# Non-interactive mode (auto-start)
echo "" | node test-mcp-features.js
```

## What the Tests Do

The suite tests all 20 claimed features:

### Navigation
- Navigate to URLs

### Content Reading
- Read page DOM
- Get page text

### Interaction
- Screenshot
- Scrolling
- Clicking (manual/separate test)

### Tab Management
- Get tab context
- Create new tabs

### Debugging
- Read console messages
- Read network requests

### Form & Find
- Find elements by query
- Fill form inputs (requires refs from find)

### JavaScript
- Execute JavaScript in page context

### Window Management
- Resize window

### Shortcuts
- List shortcuts
- Execute shortcuts (requires existing shortcuts)

### Workflow
- Update/create plans

## Expected Duration

- Full suite: ~2-3 minutes
- Each category: ~10-30 seconds
- Individual tools: 0.5-5 seconds

## Troubleshooting

### "Tool execution timed out"
- **Cause**: No browser tab is open or extension is not active
- **Fix**: Open Chrome and navigate to a regular website

### "No tab available"
- **Cause**: No tabs in the browser
- **Fix**: Open at least one tab with a normal website

### "Permission denied"
- **Cause**: Extension needs permission for the domain
- **Fix**: Click "Allow" when the extension prompts for permission

### All tests failing
1. Reload the extension in `chrome://extensions/`
2. Open a new tab with https://example.com
3. Wait 5 seconds for extension to initialize
4. Run tests again

## Test Output

The test suite provides:
- Real-time progress with ✓/✗ indicators
- Detailed error messages for failures
- Summary with pass rate at the end
- Categorized results

Example output:
```
✓ [TEST] Navigate to URL: PASSED
✓ [TEST] Read page DOM: PASSED
✗ [TEST] Take screenshot: FAILED - No image data in response
⊘ [TEST] Fill form input: SKIPPED - Requires manual ref

📊 Pass Rate: 85.7% (excluding skipped tests)
```
