#!/usr/bin/env bash

# Start Chrome MCP HTTP Server
# This allows OpenCode to connect via HTTP/SSE transport

cd "$(dirname "$0")"

echo "Starting Chrome MCP HTTP Server on port 3457..."
echo "Press Ctrl+C to stop"
echo ""

node dist/cli.js --http 3457 --spawn
