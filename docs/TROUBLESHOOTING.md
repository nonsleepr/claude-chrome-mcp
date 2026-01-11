# Troubleshooting

This guide helps resolve common issues with `claude-chrome-mcp`.

## Installation Issues

### Native host not found after installation

**Symptoms**:
- Extension shows "Native host not found" error
- Browser console shows connection errors

**Solutions**:

1. **Verify installation**:
   ```bash
   claude-chrome-mcp --status
   ```

2. **Check manifest files exist**:
   ```bash
   # Linux
   ls ~/.config/google-chrome/NativeMessagingHosts/
   ls ~/.config/chromium/NativeMessagingHosts/
   
   # macOS
   ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
   
   # Windows
   dir %LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts\
   ```

3. **Ensure wrapper script is executable** (Linux/macOS):
   ```bash
   ls -la ~/.local/share/claude-chrome-mcp/
   # Should show: -rwxr-xr-x (executable bit set)
   ```

4. **Completely restart Chrome**:
   - Quit Chrome entirely (not just close windows)
   - On macOS: Cmd+Q
   - On Linux/Windows: File → Exit
   - Reopen Chrome

### Wrapper script permissions error (Linux/macOS)

**Error**: `Permission denied` when Chrome tries to launch native host

**Solution**:
```bash
chmod +x ~/.local/share/claude-chrome-mcp/claude-chrome-mcp-native-host
```

### Wrong Chrome/Chromium detected

**Issue**: Manifest installed in wrong browser's directory

**Solution**:
- Check which browser directories exist
- Manually copy manifest to correct location
- Or reinstall after ensuring the correct browser is installed

---

## Connection Issues

### Port already in use

**Error**: `Port 3456 is already in use by another process`

**Solutions**:

1. **Find what's using the port**:
   ```bash
   # Linux/Mac
   lsof -i :3456
   
   # Windows
   netstat -ano | findstr :3456
   ```

2. **Stop the conflicting process**:
   ```bash
   # Linux/Mac (if you find PID from lsof)
   kill <PID>
   
   # Windows (if you find PID from netstat)
   taskkill /PID <PID> /F
   ```

3. **Or reinstall with a different port**:
   ```bash
   claude-chrome-mcp --uninstall
   claude-chrome-mcp --install --port 8080 --auth-token "your-token"
   ```

### Connection timeout

**Symptoms**:
- MCP client can't connect to `http://localhost:3456/mcp`
- "Connection refused" or timeout errors

**Solutions**:

1. **Verify native host is running**:
   ```bash
   # Linux/Mac
   ps aux | grep claude-chrome-mcp
   
   # Windows
   tasklist | findstr claude-chrome-mcp
   ```

2. **Check Chrome extension is active**:
   - Open `chrome://extensions`
   - Ensure Claude extension is enabled
   - Check for errors in extension's console (background page)

3. **Verify the extension connected to native host**:
   - Open Chrome extension background page console
   - Look for connection messages

4. **Test the endpoint manually**:
   ```bash
   curl -v http://localhost:3456/mcp
   # Should get 400 or 401 error (not connection refused)
   ```

### Authentication failed (401 error)

**Error**: `Authentication required` or `401 Unauthorized`

**Solutions**:

1. **Verify token is configured in MCP client**:
   ```json
   {
     "mcpServers": {
       "claude_chrome": {
         "transport": {
           "type": "http",
           "url": "http://localhost:3456/mcp",
           "headers": {
             "Authorization": "Bearer YOUR_TOKEN_HERE"
           }
         }
       }
     }
   }
   ```

2. **Check token matches installation**:
   - Token is set at installation time with `--auth-token`
   - To change token, reinstall with new token

3. **For mcp-remote users**:
   ```json
   {
     "mcpServers": {
       "claude_chrome": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "http://localhost:3456/mcp"],
         "env": {
           "MCP_REMOTE_HEADERS": "{\"Authorization\": \"Bearer YOUR_TOKEN\"}"
         }
       }
     }
   }
   ```

---

## Tool Execution Issues

### Tool execution timeout

**Error**: `Tool execution timed out after 60000ms`

**Causes**:
- Page is very slow to load
- JavaScript performing long-running operations
- Page is unresponsive or frozen
- Network requests hanging

**Solutions**:

1. **Check page loaded successfully**:
   - Use `get_page_text` or `read_page` to verify page state
   
2. **Break operation into smaller steps**:
   - Instead of one large operation, use multiple smaller tool calls
   
3. **Check page state**:
   ```typescript
   // Use javascript_tool to check if page is ready
   document.readyState  // Should be "complete"
   ```

4. **Verify network connectivity**:
   - Use `read_network_requests` to check for failed requests

### Tab ID invalid or not found

**Error**: `Tab not found` or `Invalid tab ID`

**Causes**:
- Tab was closed by user
- Using tab ID from previous session
- Tab crashed or navigated away

**Solutions**:

1. **Create a new tab**:
   ```typescript
   // Use tabs_create to get a fresh tab
   await executeTool('tabs_create', { url: 'https://example.com' });
   ```

2. **List available tabs**:
   ```typescript
   // Use tabs_context to see current tabs
   await executeTool('tabs_context', {});
   ```

3. **Never reuse tab IDs across sessions**:
   - Always create new tabs at the start of a task
   - Don't hardcode tab IDs

### Element not found or not interactable

**Symptoms**:
- Click actions fail
- Element references don't work
- Form inputs fail

**Solutions**:

1. **Verify element exists**:
   ```typescript
   // Use read_page to inspect DOM
   await executeTool('read_page', { tabId, depth: 10 });
   ```

2. **Use find tool for dynamic content**:
   ```typescript
   // Search by text content
   await executeTool('find', { 
     tabId, 
     query: 'Login button' 
   });
   ```

3. **Wait for page to load**:
   ```typescript
   // Use computer tool to wait
   await executeTool('computer', { 
     tabId, 
     action: 'wait', 
     text: '2'  // Wait 2 seconds
   });
   ```

4. **Check element is in viewport**:
   ```typescript
   // Use scroll_to to bring element into view
   await executeTool('computer', {
     tabId,
     action: 'scroll_to',
     ref: 'ref_123'
   });
   ```

---

## Browser-Specific Issues

### Chrome blocks automation

**Issue**: Browser detects automated control

**Solution**:
- This should not happen with the Chrome extension approach
- If it does, report as a bug

### Page requires user interaction

**Issue**: Some pages require real user clicks (e.g., OAuth popups)

**Solution**:
- Inform user they need to manually complete the action
- Resume automation after manual interaction

### Browser dialogs freeze session

**Issue**: JavaScript alerts, confirms, prompts block all automation

**Prevention**:
- Avoid triggering browser dialogs
- Use `console.log()` via `javascript_tool` instead of `alert()`
- Check for dialog-triggering elements before clicking

**Recovery**:
- User must manually dismiss the dialog
- Session will resume after dialog is closed

---

## Platform-Specific Issues

### Linux: Runtime detection issues

**Issue**: Wrong runtime (Bun vs Node.js) detected

**Solution**:
```bash
# Verify which runtime is in PATH
which node
which bun

# Force specific runtime by reinstalling
claude-chrome-mcp --uninstall
# Ensure desired runtime is first in PATH
claude-chrome-mcp --install
```

### macOS: Permission denied errors

**Issue**: macOS Gatekeeper blocking execution

**Solution**:
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine ~/.local/share/claude-chrome-mcp/*
```

### Windows: Batch file not executing

**Issue**: Windows Defender or antivirus blocking wrapper script

**Solution**:
- Add exception in Windows Defender for the wrapper directory
- Check antivirus logs for blocked executions

---

## Debugging Tips

### Enable verbose logging

**Chrome Extension Console**:
1. Navigate to `chrome://extensions`
2. Find Claude extension
3. Click "background page" under "Inspect views"
4. Check console for native host messages

### Check wrapper script

**Linux/macOS**:
```bash
cat ~/.local/share/claude-chrome-mcp/claude-chrome-mcp-native-host
# Should show bash script with correct paths
```

**Windows**:
```cmd
type %USERPROFILE%\.claude-chrome-mcp\claude-chrome-mcp-native-host.bat
# Should show batch file with correct paths
```

### Test native host manually

**Not recommended** (stdin/stdout protocol is complex), but possible:

```bash
# Run native host directly
~/.local/share/claude-chrome-mcp/claude-chrome-mcp-native-host

# It will wait for Chrome protocol messages on stdin
# Press Ctrl+C to exit
```

### Verify MCP server is listening

```bash
# Test endpoint
curl http://localhost:3456/mcp

# Should return JSON-RPC error (not connection refused)
```

---

## Getting Help

If none of these solutions work:

1. **Check GitHub Issues**: [anthropics/claude-chrome-mcp/issues](https://github.com/anthropics/claude-chrome-mcp/issues)
2. **File a bug report** with:
   - OS and version
   - Chrome version
   - Installation method (npm/bun)
   - Full error messages
   - Output of `claude-chrome-mcp --status`
3. **Include logs** from:
   - Chrome extension console
   - Terminal output (stderr)
   - Any relevant error messages
