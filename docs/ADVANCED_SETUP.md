# Chrome Extension Native Messaging Setup Guide

This document describes how to set up the Claude Browser Extension to work with the MCP server via native messaging.

## Overview

The integration chain:
```
Chrome Extension ←→ Native Host (stdio) ←→ Native Host Socket ←→ MCP Server
```

## Prerequisites

- Chrome/Chromium browser installed
- Claude Browser Extension installed in Chrome
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- Node.js installed

## Setup Steps

### 1. Create Wrapper Script

The wrapper script launches the native host when Chrome requests it.

**Location**: `~/.claude/chrome/chrome-native-host`

```bash
#!/run/current-system/sw/bin/bash
exec "/home/nonsleepr/.npm-global/bin/claude" --chrome-native-host
```

**Important Notes**:
- On NixOS, use `/run/current-system/sw/bin/bash` instead of `/bin/bash`
- On standard Linux: use `/bin/bash`
- On macOS: use `/bin/bash`
- Adjust the path to `claude` based on your installation (`which claude`)

Make it executable:
```bash
chmod +x ~/.claude/chrome/chrome-native-host
```

### 2. Install Native Messaging Manifest

The manifest tells Chrome how to launch the native host.

**Location** (Linux): `~/.config/chromium/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`

**Location** (Chrome on Linux): `~/.config/google-chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`

**Content**:
```json
{
  "name": "com.anthropic.claude_code_browser_extension",
  "description": "Claude Code Browser Extension Native Host",
  "path": "/home/YOUR_USERNAME/.claude/chrome/chrome-native-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/"
  ]
}
```

**Important**:
- Replace `YOUR_USERNAME` with your actual username
- The extension ID `fcoeoabgfenejglbffodgkkbkcdhcgfn` is the standard Claude Browser Extension ID
- If your extension has a different ID, update the `allowed_origins` field

Create the directory and file:
```bash
mkdir -p ~/.config/chromium/NativeMessagingHosts
cat > ~/.config/chromium/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json << 'EOF'
{
  "name": "com.anthropic.claude_code_browser_extension",
  "description": "Claude Code Browser Extension Native Host",
  "path": "/home/YOUR_USERNAME/.claude/chrome/chrome-native-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/"
  ]
}
EOF
```

### 3. Reload Chrome Extension

After installing the manifest:

1. Open Chrome/Chromium
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Find "Claude Browser Extension"
5. Click the reload button (circular arrow icon)
6. Open a new tab and navigate to any website

The extension should now automatically launch the native host.

## Verification

### Check if Native Host is Running

Run the verification script:
```bash
node verify-native-host.js
```

This checks:
- ✓ Native messaging manifest exists
- ✓ Wrapper script exists and is executable
- ✓ Native host process is running
- ✓ Socket file exists and accepts connections

### Manual Test

Test the wrapper script directly:
```bash
~/.claude/chrome/chrome-native-host
```

Expected output:
```
[Claude Chrome Native Host] Initializing...
[Claude Chrome Native Host] Creating socket listener: /tmp/claude-mcp-browser-bridge-YOUR_USERNAME
[Claude Chrome Native Host] Socket server listening for connections
[Claude Chrome Native Host] Socket permissions set to 0600
```

### Test MCP Integration

Run the integration test:
```bash
node test-chrome-native-messaging.js
```

This will:
1. Wait for the socket to appear (up to 30 seconds)
2. Connect to the native host
3. Test tool execution (`list_pages`, `navigate`, `read_page`)

## Troubleshooting

### Native Host Not Starting

**Symptom**: Socket file doesn't exist, process not running

**Solutions**:
1. Check wrapper script shebang line matches your system's bash location
2. Verify wrapper script is executable: `ls -la ~/.claude/chrome/chrome-native-host`
3. Test wrapper script manually (see above)
4. Check Chrome extension console for errors

### "Bad Interpreter" Error

**Symptom**: `/bin/bash: no such file or directory`

**Solution**: Update wrapper script shebang to correct bash path:
```bash
which bash  # Find correct path
# Update first line of ~/.claude/chrome/chrome-native-host
```

### Extension ID Mismatch

**Symptom**: Native host never starts, no errors in extension console

**Solution**:
1. Go to `chrome://extensions/`
2. Find Claude extension and copy the ID
3. Update the manifest's `allowed_origins` field with correct extension ID

### "Specified Native Messaging Host Not Found"

**Symptom**: Error in extension console

**Solutions**:
1. Verify manifest path matches Chrome/Chromium:
   - Chromium: `~/.config/chromium/NativeMessagingHosts/`
   - Chrome: `~/.config/google-chrome/NativeMessagingHosts/`
2. Check manifest filename matches: `com.anthropic.claude_code_browser_extension.json`
3. Verify manifest JSON is valid (use `jq` or JSON validator)

### Socket Exists But Connection Refused

**Symptom**: Socket file exists but `ECONNREFUSED` error

**Solution**: The native host process died. Check:
1. Wrapper script bash path is correct
2. Claude CLI is properly installed: `which claude`
3. Native host logs for errors

## Platform-Specific Notes

### NixOS
- Bash location: `/run/current-system/sw/bin/bash`
- Standard `/bin/bash` does not exist
- Use absolute paths for all executables

### Standard Linux (Ubuntu, Debian, etc.)
- Bash location: `/bin/bash`
- Chrome: `~/.config/google-chrome/`
- Chromium: `~/.config/chromium/`

### macOS
- Bash location: `/bin/bash`
- Manifest location: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`

### Windows
- Use PowerShell script or batch file instead of bash
- Manifest registered in Windows Registry
- See Chrome Native Messaging documentation for Windows setup

## Files Created

After setup, these files should exist:

```
~/.claude/chrome/chrome-native-host               # Wrapper script (executable)
~/.config/chromium/NativeMessagingHosts/
  └── com.anthropic.claude_code_browser_extension.json  # Manifest
/tmp/claude-mcp-browser-bridge-YOUR_USERNAME     # Socket (when running)
```

## Success Indicators

✓ Native host process visible in `ps aux | grep chrome-native-host`
✓ Socket file exists: `/tmp/claude-mcp-browser-bridge-YOUR_USERNAME`
✓ Socket accepts connections (test with verification script)
✓ Extension console shows no native messaging errors
✓ `node test-chrome-native-messaging.js` connects successfully

## Known Issues

### "T is not defined" Error

**Symptom**: Connection succeeds but tool execution returns "T is not defined"

**Status**: Under investigation - likely a bug in the Chrome extension or native host protocol handling

**Workaround**: TBD

## Next Steps After Setup

Once native messaging is working:

1. Use the MCP server with stdio transport:
   ```bash
   claude-chrome-mcp
   ```

2. Or with HTTP transport:
   ```bash
   claude-chrome-mcp --http 3456
   ```

3. Configure your MCP client (Claude Desktop, etc.) to use the server

## References

- [Chrome Native Messaging Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Claude Browser Extension Repository](https://github.com/anthropics/claude-browser-extension)
- Project docs: `docs/NATIVE_MESSAGING_ARCHITECTURE.md`
