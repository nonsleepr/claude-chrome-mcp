# Chrome Extension Native Messaging Architecture

This document provides a comprehensive technical reference for the Claude Browser Extension's native messaging system, including the communication protocols, message formats, and integration patterns.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [Native Host Installation](#native-host-installation)
4. [Wire Protocol](#wire-protocol)
5. [Message Types and Formats](#message-types-and-formats)
6. [Tool Execution Flow](#tool-execution-flow)
7. [Connection Lifecycle](#connection-lifecycle)
8. [Error Handling](#error-handling)

---

## Overview

The Claude Browser Extension uses Chrome's [Native Messaging API](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) to communicate with external processes. This enables:

1. **Browser Automation**: External programs can control browser tabs, navigate pages, fill forms, take screenshots, etc.
2. **MCP Integration**: The Model Context Protocol (MCP) clients can access browser tools
3. **Bidirectional Communication**: Both the extension and external clients can initiate requests

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Operating System                                │
│                                                                              │
│  ┌────────────────────┐     ┌────────────────────┐     ┌──────────────────┐ │
│  │   MCP Client       │     │   Native Host      │     │ Chrome Browser   │ │
│  │   (Claude Code,    │     │   Process          │     │                  │ │
│  │    other tools)    │     │                    │     │ ┌──────────────┐ │ │
│  │                    │     │  ┌──────────────┐  │     │ │  Extension   │ │ │
│  │                    │◀───▶│  │ Socket       │  │◀───▶│ │  Service     │ │ │
│  │                    │     │  │ Server       │  │     │ │  Worker      │ │ │
│  │                    │     │  └──────────────┘  │     │ └──────────────┘ │ │
│  │                    │     │  ┌──────────────┐  │     │                  │ │
│  │                    │     │  │ stdio        │  │     │                  │ │
│  │                    │     │  │ Handler      │  │     │                  │ │
│  │                    │     │  └──────────────┘  │     │                  │ │
│  └────────────────────┘     └────────────────────┘     └──────────────────┘ │
│                                                                              │
│         Unix Socket              Native Messaging                            │
│         (or Named Pipe)          (stdin/stdout)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Components

### 1. Chrome Extension (Service Worker)

**Location**: `assets/service-worker.ts-Bo1zOX7Y.js`

The extension's service worker:
- Initiates connection to native host via `chrome.runtime.connectNative()`
- Registers message handlers for incoming tool requests
- Executes browser tools and returns results
- Maintains connection state and handles reconnection

**Key Functions**:
| Function | Purpose |
|----------|---------|
| `P()` | Attempts to connect to native host, returns boolean |
| `S()` | Disconnects from native host |
| `N(t)` | Message handler for incoming messages |
| `L()` | Sends tool response back to native host |
| `h()` | Executes a tool and returns result |

### 2. Native Host Process

**Invocation**: `node cli.js --chrome-native-host`

The native host is a Node.js process that:
- Reads/writes Chrome native messaging format on stdin/stdout
- Runs a Unix socket server for MCP clients
- Routes messages between Chrome extension and MCP clients

**Key Classes**:
| Class | Purpose |
|-------|---------|
| `UV9` | Socket server for MCP client connections |
| `wV9` | stdin reader for Chrome native messaging |

### 3. Native Host Manifest

**Location** (Linux): `~/.config/google-chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`

```json
{
  "name": "com.anthropic.claude_code_browser_extension",
  "description": "Claude Code Browser Extension Native Host",
  "path": "/home/user/.claude/chrome/chrome-native-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/"
  ]
}
```

### 4. Wrapper Script

**Location**: `~/.claude/chrome/chrome-native-host`

```bash
#!/bin/bash
exec "/path/to/node" "/path/to/cli.js" --chrome-native-host
```

---

## Native Host Installation

### Platform-Specific Paths

| Platform | Manifest Location |
|----------|-------------------|
| Linux | `~/.config/google-chrome/NativeMessagingHosts/` |
| macOS | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` |
| Windows | Registry: `HKCU\Software\Google\Chrome\NativeMessagingHosts\{name}` + file path |

### Installation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code Startup (with Chrome integration enabled)          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Create wrapper script                                        │
│     Path: ~/.claude/chrome/chrome-native-host                   │
│     Content: #!/bin/bash                                        │
│              exec "node" "cli.js" --chrome-native-host          │
│     Permissions: 0755 (executable)                              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Create native host manifest                                  │
│     Path: ~/.config/google-chrome/NativeMessagingHosts/         │
│           com.anthropic.claude_code_browser_extension.json      │
│     Content: JSON with name, path, type, allowed_origins        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. (Windows only) Register in Windows Registry                  │
│     Key: HKCU\Software\Google\Chrome\NativeMessagingHosts\      │
│          com.anthropic.claude_code_browser_extension            │
│     Value: Path to manifest JSON file                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Wire Protocol

### Chrome Native Messaging Format

All messages use a simple length-prefixed format:

```
┌────────────────┬──────────────────────────────────────────┐
│  Length (4B)   │  JSON Payload (variable length)          │
│  Little-endian │                                          │
│  uint32        │                                          │
└────────────────┴──────────────────────────────────────────┘
```

**Example**: Sending `{"type":"ping"}`

```
Bytes: 0F 00 00 00 7B 22 74 79 70 65 22 3A 22 70 69 6E 67 22 7D
       └────┬────┘ └────────────────────┬────────────────────┘
         Length=15         JSON: {"type":"ping"}
```

### Maximum Message Size

```javascript
const JR0 = 1024 * 1024; // 1 MB maximum message size
```

### Socket Protocol (MCP Clients)

MCP clients connect via Unix socket using the same wire format:

| Platform | Socket Path |
|----------|-------------|
| Linux/macOS | `/tmp/claude-code-mcp-{username}.sock` |
| Windows | `\\.\pipe\claude-code-mcp-{username}` |

---

## Message Types and Formats

### Extension → Native Host Messages

#### 1. Ping (Heartbeat)

```json
{
  "type": "ping"
}
```

Response:
```json
{
  "type": "pong",
  "timestamp": 1704067200000
}
```

#### 2. Get Status

```json
{
  "type": "get_status"
}
```

Response:
```json
{
  "type": "status_response",
  "native_host_version": "1.0.0"
}
```

#### 3. Tool Response (after executing a tool)

```json
{
  "type": "tool_response",
  "result": {
    "content": "Navigation successful. Page loaded: Example Domain"
  }
}
```

Or with error:
```json
{
  "type": "tool_response",
  "error": {
    "content": "Permission denied by user"
  }
}
```

#### 4. MCP Connection Events

```json
{
  "type": "mcp_connected"
}
```

```json
{
  "type": "mcp_disconnected"
}
```

### Native Host → Extension Messages

#### 1. Tool Request

```json
{
  "type": "tool_request",
  "method": "execute_tool",
  "params": {
    "tool": "navigate",
    "args": {
      "url": "https://example.com"
    },
    "tabId": 12345,
    "tabGroupId": 1,
    "client_id": "mcp-client-1"
  }
}
```

### MCP Client → Native Host Messages

MCP clients send tool requests in a simplified format (the native host wraps them):

```json
{
  "method": "execute_tool",
  "params": {
    "tool": "navigate",
    "args": {
      "url": "https://example.com"
    }
  }
}
```

---

## Tool Execution Flow

### Complete Request/Response Cycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  MCP Client  │     │ Native Host  │     │  Extension   │     │   Browser    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ 1. Connect         │                    │                    │
       │───────────────────▶│                    │                    │
       │                    │                    │                    │
       │ 2. Send request    │                    │                    │
       │ {method:           │                    │                    │
       │  execute_tool,     │                    │                    │
       │  params: {...}}    │                    │                    │
       │───────────────────▶│                    │                    │
       │                    │                    │                    │
       │                    │ 3. Wrap & forward  │                    │
       │                    │ {type:             │                    │
       │                    │  tool_request,...} │                    │
       │                    │───────────────────▶│                    │
       │                    │                    │                    │
       │                    │                    │ 4. Execute tool    │
       │                    │                    │───────────────────▶│
       │                    │                    │                    │
       │                    │                    │ 5. Get result      │
       │                    │                    │◀───────────────────│
       │                    │                    │                    │
       │                    │ 6. Send response   │                    │
       │                    │ {type:             │                    │
       │                    │  tool_response,    │                    │
       │                    │  result: {...}}    │                    │
       │                    │◀───────────────────│                    │
       │                    │                    │                    │
       │ 7. Forward result  │                    │                    │
       │ {content: "..."}   │                    │                    │
       │◀───────────────────│                    │                    │
       │                    │                    │                    │
```

### Tool Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool` | string | Yes | Tool name (e.g., "navigate", "computer", "read_page") |
| `args` | object | Yes | Tool-specific arguments |
| `tabId` | number | No | Target tab ID |
| `tabGroupId` | number | No | Target tab group ID |
| `client_id` | string | No | Client identifier for routing responses |

### Tool Response Format

**Success Response**:
```json
{
  "content": "string or array of content blocks",
  "tabContext": {
    "currentTabId": 12345,
    "executedOnTabId": 12345,
    "availableTabs": [
      {"id": 12345, "title": "Example", "url": "https://example.com"}
    ],
    "tabCount": 1,
    "tabGroupId": 1
  }
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "is_error": true
}
```

**Permission Required Response**:
```json
{
  "type": "permission_required",
  "tool": "navigate",
  "url": "https://example.com",
  "toolUseId": "tool_use_123",
  "actionData": {}
}
```

---

## Connection Lifecycle

### Extension Startup Sequence

```
┌─────────────────────────────────────────────────────────────────┐
│  Extension Service Worker Starts                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Check nativeMessaging permission                             │
│     chrome.permissions.contains({permissions:["nativeMessaging"]})│
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Try connecting to native hosts (in order):                   │
│     - com.anthropic.claude_browser_extension (Desktop)           │
│     - com.anthropic.claude_code_browser_extension (Claude Code)  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Send ping, wait for pong (10 second timeout)                 │
│     port.postMessage({type: "ping"})                             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                   ┌────────────┴────────────┐
                   │                         │
                   ▼                         ▼
          ┌───────────────┐         ┌───────────────┐
          │  Pong received │         │  Timeout/Error│
          │  Connection OK │         │  Try next host│
          └───────┬───────┘         └───────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Register message handlers                                    │
│     - port.onMessage.addListener(N)                             │
│     - port.onDisconnect.addListener(cleanup)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Request status                                               │
│     port.postMessage({type: "get_status"})                       │
└─────────────────────────────────────────────────────────────────┘
```

### State Variables

```javascript
let _ = null;    // Current native messaging port
let g = null;    // Current native host name
let b = false;   // Is native host installed?
let I = false;   // Is MCP connected?
let T = false;   // Connection attempt in progress?
```

### Reconnection Handling

On disconnect, the extension:
1. Clears connection state (`_ = null`, `g = null`, `I = false`)
2. Checks for "native messaging host not found" error
3. Notifies UI components via callback `u()`

---

## Error Handling

### Error Types

| Error | Cause | Recovery |
|-------|-------|----------|
| `native messaging host not found` | Manifest not installed | Install native host |
| `Disconnected` | Process crashed/killed | Attempt reconnection |
| `Permission denied` | Host not in allowed_origins | Check manifest |
| `Message too large` | Exceeds 1MB limit | Split message |

### Permission Denied Handling

When a user denies a tool action:

```javascript
// Error response includes special instruction
const errorMessage = `${error} - IMPORTANT: The user has explicitly declined this action. Do not attempt to use other tools or workarounds. Instead, acknowledge the denial and ask the user how they would prefer to proceed.`;
```

### Timeout Handling

- Ping/pong timeout: 10 seconds
- If no response, connection attempt fails and tries next host

---

## Available Tools

The extension exposes 23 browser automation tools. See [TOOLS.md](./TOOLS.md) for detailed documentation of each tool's schema and behavior.

### Tool Categories

| Category | Tools |
|----------|-------|
| Navigation | `navigate` |
| Interaction | `computer`, `form_input`, `find` |
| Content | `read_page`, `get_page_text` |
| Tab Management | `tabs_context`, `tabs_create`, `tabs_context_mcp`, `tabs_create_mcp`, `resize_window` |
| Debugging | `read_console_messages`, `read_network_requests` |
| Media | `upload_image`, `gif_creator` |
| Workflow | `update_plan`, `shortcuts_list`, `shortcuts_execute` |
| Code Execution | `javascript_tool` |
| Utility | `turn_answer_start`, `turn_answer_complete`, `dev_utils`, `permissions_check` |

---

## Security Considerations

### Extension ID Verification

The manifest's `allowed_origins` restricts which extensions can connect:

```json
{
  "allowed_origins": [
    "chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/"
  ]
}
```

### Socket Permissions

The Unix socket is created with restricted permissions:
```javascript
chmod(socketPath, 0o600); // Owner read/write only
```

### URL Restrictions

The extension blocks tool execution on sensitive URLs:
- `chrome://` (browser internals)
- `chrome-extension://` (other extensions)
- `about:` (special pages)
- `devtools://` (developer tools)
- `edge://`, `brave://` (other browsers)
