/**
 * Native Host Manifest Installation
 * 
 * Creates the native messaging host manifest for Chrome/Chromium.
 * The manifest tells Chrome how to launch the native host process.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { DEFAULT_EXTENSION_ID, MANIFEST_NAME } from './constants.js';
import {
  title,
  section,
  statusLine,
  symbols,
  secure,
  insecure,
  insecureWithBg,
  info,
  warningBlock,
  code,
  highlightJSON,
  dim,
  path as pathColor,
  url,
  success,
} from './utils/format.js';

export interface InstallOptions {
  extensionId?: string;
  verbose?: boolean;
  port?: number;
  authToken?: string;
  corsOrigins?: string[];
  insecure?: boolean;
}

type Runtime = 'bun' | 'node';

interface RuntimeInfo {
  runtime: Runtime;
  execPath: string;
}

/**
 * Generate a secure random token (256-bit)
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Detect which runtime to use (bun or node)
 */
function detectRuntime(): RuntimeInfo {
  // Strategy 1: Check npm_config_user_agent environment variable
  const userAgent = process.env.npm_config_user_agent || '';
  
  if (userAgent.includes('bun')) {
    // User installed with bun, try to find bun executable
    try {
      const bunPath = process.platform === 'win32' 
        ? execSync('where bun', { encoding: 'utf8' }).trim().split('\n')[0]
        : execSync('which bun', { encoding: 'utf8' }).trim();
      
      if (bunPath && fs.existsSync(bunPath)) {
        return { runtime: 'bun', execPath: bunPath };
      }
    } catch (error) {
      // Bun not found in PATH, fall back to checking if it exists
    }
  }
  
  // Strategy 2: Check if bun executable exists (even if not installed via bun)
  try {
    const bunPath = process.platform === 'win32'
      ? execSync('where bun', { encoding: 'utf8' }).trim().split('\n')[0]
      : execSync('which bun', { encoding: 'utf8' }).trim();
    
    if (bunPath && fs.existsSync(bunPath)) {
      return { runtime: 'bun', execPath: bunPath };
    }
  } catch (error) {
    // Bun not available, will use Node
  }
  
  // Default: Use Node.js
  return { runtime: 'node', execPath: process.execPath };
}

/**
 * Get the path to the native host executable script
 */
function getExecutablePath(): string {
  // When installed globally via npm/bun, this script runs from dist/cli.js
  // We need to return the path to the installed binary
  
  // Check if we're running from node_modules (global install)
  const scriptPath = process.argv[1];
  
  // Return the script path - the wrapper will invoke it with the detected runtime
  return scriptPath;
}

/**
 * Create a wrapper script for the native host
 */
function createWrapperScript(targetDir: string, scriptPath: string, runtimeInfo: RuntimeInfo, options: InstallOptions): string {
  const wrapperPath = path.join(targetDir, 'claude-chrome-mcp-native-host');
  
  if (process.platform === 'win32') {
    // Windows batch file
    const batchPath = wrapperPath + '.bat';
    const envVars: string[] = [];
    
    if (options.port) {
      envVars.push(`set MCP_PORT=${options.port}`);
    }
    if (options.authToken) {
      envVars.push(`set MCP_AUTH_TOKEN=${options.authToken}`);
    }
    if (options.corsOrigins && options.corsOrigins.length > 0) {
      envVars.push(`set MCP_CORS_ORIGINS=${options.corsOrigins.join(',')}`);
    }
    
    const content = `@echo off\r\n${envVars.join('\r\n')}${envVars.length > 0 ? '\r\n' : ''}"${runtimeInfo.execPath}" "${scriptPath}" %*\r\n`;
    fs.writeFileSync(batchPath, content);
    return batchPath;
  } else {
    // Unix shell script
    const envVars: string[] = [];
    
    if (options.port) {
      envVars.push(`export MCP_PORT=${options.port}`);
    }
    if (options.authToken) {
      envVars.push(`export MCP_AUTH_TOKEN="${options.authToken}"`);
    }
    if (options.corsOrigins && options.corsOrigins.length > 0) {
      envVars.push(`export MCP_CORS_ORIGINS="${options.corsOrigins.join(',')}"`);
    }
    
    const content = `#!/usr/bin/env bash\n${envVars.join('\n')}${envVars.length > 0 ? '\n' : ''}exec "${runtimeInfo.execPath}" "${scriptPath}" "$@"\n`;
    fs.writeFileSync(wrapperPath, content, { mode: 0o755 });
    return wrapperPath;
  }
}

/**
 * Get native messaging host directories for the current platform
 */
function getNativeMessagingDirs(): string[] {
  const home = os.homedir();

  if (process.platform === 'darwin') {
    return [
      path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
      path.join(home, 'Library/Application Support/Chromium/NativeMessagingHosts'),
      path.join(home, 'Library/Application Support/Google/Chrome Beta/NativeMessagingHosts'),
      path.join(home, 'Library/Application Support/Google/Chrome Canary/NativeMessagingHosts'),
    ];
  } else if (process.platform === 'linux') {
    return [
      path.join(home, '.config/google-chrome/NativeMessagingHosts'),
      path.join(home, '.config/chromium/NativeMessagingHosts'),
      path.join(home, '.config/google-chrome-beta/NativeMessagingHosts'),
      path.join(home, '.config/google-chrome-unstable/NativeMessagingHosts'),
    ];
  } else if (process.platform === 'win32') {
    // Windows uses registry primarily, but also supports manifest files
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData/Local');
    return [
      path.join(localAppData, 'Google/Chrome/User Data/NativeMessagingHosts'),
      path.join(localAppData, 'Chromium/User Data/NativeMessagingHosts'),
    ];
  }

  return [];
}

/**
 * Get the directory for storing wrapper scripts
 */
function getWrapperDir(): string {
  const home = os.homedir();
  
  if (process.platform === 'win32') {
    return path.join(home, '.claude-chrome-mcp');
  } else {
    return path.join(home, '.local/share/claude-chrome-mcp');
  }
}

/**
 * Install the native host manifest
 */
export async function installNativeHost(options: InstallOptions = {}): Promise<void> {
  const extensionId = options.extensionId ?? DEFAULT_EXTENSION_ID;
  const verbose = options.verbose ?? true;
  
  // Auto-generate token unless --insecure flag is set or user provided a token
  let authToken = options.authToken;
  let tokenAutoGenerated = false;
  
  if (!authToken && !options.insecure) {
    authToken = generateToken();
    tokenAutoGenerated = true;
  }
  
  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  log(title('Installing Claude Chrome MCP Native Host'));
  log('');

  // Detect runtime
  const runtimeInfo = detectRuntime();
  log(section('Detecting environment...'));
  log(statusLine(`Runtime: ${runtimeInfo.runtime} (${runtimeInfo.execPath})`, 'success'));
  log(statusLine(`Extension ID: ${extensionId}`, 'success'));
  log('');

  // Security configuration summary
  log(section('Security Configuration:'));
  if (authToken) {
    const tokenSource = tokenAutoGenerated ? 'Auto-generated (secure)' : 'Enabled';
    log(statusLine('Auth Token: ' + secure(tokenSource), 'success'));
  } else {
    log(statusLine('Auth Token: ' + insecureWithBg('DISABLED - INSECURE!'), 'error'));
  }
  
  if (options.corsOrigins && options.corsOrigins.length > 0) {
    log(statusLine(`CORS: ${options.corsOrigins.join(', ')}`, 'info'));
  } else {
    log(statusLine('CORS: localhost only (default)', 'info'));
  }
  
  if (options.port) {
    log(statusLine(`Port: ${options.port}`, 'info'));
  } else {
    log(statusLine('Port: 3456 (default)', 'info'));
  }
  log('');

  // Show security warning if no auth token
  if (!authToken) {
    log(warningBlock([
      '',
      'No authentication configured!',
      '',
      'Anyone with access to localhost can control your browser.',
      'This is INSECURE and not recommended for production use.',
      '',
      'For secure installation, run without --insecure flag:',
      `  ${code('$ claude-chrome-mcp --install')}`,
      '',
    ]));
  }

  // Create wrapper directory
  const wrapperDir = getWrapperDir();
  log(section('Creating installation files...'));
  if (!fs.existsSync(wrapperDir)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
    log(statusLine(`Wrapper directory: ${pathColor(wrapperDir)}`, 'success'));
  } else {
    log(statusLine(`Wrapper directory: ${pathColor(wrapperDir)}`, 'success'));
  }

  // Create wrapper script
  const scriptPath = getExecutablePath();
  const wrapperPath = createWrapperScript(wrapperDir, scriptPath, runtimeInfo, {
    ...options,
    authToken,
  });
  log(statusLine(`Wrapper script: ${pathColor(wrapperPath)}`, 'success'));
  log('');

  // Create manifest
  const manifest = {
    name: MANIFEST_NAME,
    description: 'Claude Chrome MCP - Browser automation via Model Context Protocol',
    path: wrapperPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };

  const manifestFilename = `${MANIFEST_NAME}.json`;
  const dirs = getNativeMessagingDirs();
  let installed = false;

  log(section('Installing manifest files...'));
  for (const dir of dirs) {
    // Check if the browser config directory exists (parent of NativeMessagingHosts)
    const browserConfigDir = path.dirname(dir);
    if (!fs.existsSync(browserConfigDir)) {
      continue; // Browser not installed
    }

    // Create NativeMessagingHosts directory if needed
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create directory ${dir}:`, err);
        continue;
      }
    }

    // Write manifest file
    const manifestPath = path.join(dir, manifestFilename);
    try {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      const browserName = dir.includes('chromium') ? 'Chromium' : 'Chrome';
      log(statusLine(`${browserName}: ${pathColor(manifestPath)}`, 'success'));
      installed = true;
    } catch (err) {
      console.error(`Failed to write manifest to ${manifestPath}:`, err);
    }
  }
  log('');

  if (!installed) {
    console.error('No Chrome/Chromium installations found. Please install Chrome first.');
    process.exit(1);
  }

  log(success('Installation Complete!'));
  log('');
  
  // Display token if generated or provided
  if (authToken) {
    log('='.repeat(70));
    if (tokenAutoGenerated) {
      log('Your Authentication Token (save this securely):');
    } else {
      log('Authentication Token:');
    }
    log('='.repeat(70));
    log('');
    log(authToken);
    log('');
    log('='.repeat(70));
    log('');
  }
  
  log(section('Next Steps:'));
  log('  1. Restart Chrome/Chromium completely (quit and reopen)');
  log('  2. The native host will start automatically when extension connects');
  log('  3. Configure your MCP client with the endpoint below');
  log('');
  
  const port = options.port || 3456;
  const mcpUrl = `http://localhost:${port}/mcp`;
  log(section('MCP Endpoint:'));
  log(`  ${url(mcpUrl)}`);
  log('');
  
  log(section('MCP Client Configuration:'));
  
  if (authToken) {
    log(dim('OpenCode (~/.config/opencode/opencode.json):'));
    const opencodeConfig = {
      mcp: {
        chrome: {
          type: 'remote',
          url: mcpUrl,
          enabled: true,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      },
    };
    log(highlightJSON(opencodeConfig));
    log('');
    
    log(dim('Claude Desktop / Generic MCP Client:'));
    const genericConfig = {
      mcpServers: {
        chrome: {
          transport: {
            type: 'http',
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        },
      },
    };
    log(highlightJSON(genericConfig));
  } else {
    const exampleConfig = {
      mcpServers: {
        chrome: {
          transport: {
            type: 'http',
            url: mcpUrl,
          },
        },
      },
    };
    log(highlightJSON(exampleConfig));
  }
  
  log('');
  
  if (!authToken) {
    log(warningBlock([
      'Security Warning: No authentication configured!',
      'For secure installation, run:',
      `  ${code('$ claude-chrome-mcp --install')}`,
    ]));
  }
  
  log(dim('Tip: Check connection after restarting Chrome:'));
  log(dim(`  $ ${code('claude-chrome-mcp --status')}`));
  log('');
}

/**
 * Uninstall the native host manifest
 */
export async function uninstallNativeHost(options: { verbose?: boolean } = {}): Promise<void> {
  const verbose = options.verbose ?? true;
  
  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  log(title('Uninstalling Claude Chrome MCP Native Host'));
  log('');

  const manifestFilename = `${MANIFEST_NAME}.json`;
  const dirs = getNativeMessagingDirs();
  let uninstalled = false;

  log(section('Removing installation files...'));
  for (const dir of dirs) {
    const manifestPath = path.join(dir, manifestFilename);
    if (fs.existsSync(manifestPath)) {
      try {
        fs.unlinkSync(manifestPath);
        const browserName = dir.includes('chromium') ? 'Chromium' : 'Chrome';
        log(statusLine(`Manifest (${browserName}): ${pathColor(manifestPath)}`, 'success'));
        uninstalled = true;
      } catch (err) {
        console.error(`Failed to remove manifest from ${manifestPath}:`, err);
      }
    }
  }

  // Remove wrapper directory
  const wrapperDir = getWrapperDir();
  if (fs.existsSync(wrapperDir)) {
    try {
      fs.rmSync(wrapperDir, { recursive: true });
      log(statusLine(`Wrapper: ${pathColor(wrapperDir)}`, 'success'));
    } catch (err) {
      console.error(`Failed to remove wrapper directory:`, err);
    }
  }
  log('');

  if (uninstalled) {
    log(success('Uninstallation Complete!'));
    log('');
    log(section('Next Steps:'));
    log('  - Restart Chrome/Chromium for changes to take effect');
    log('  - MCP clients will no longer be able to connect');
    log('');
    log(dim(`To reinstall: ${code('claude-chrome-mcp --install')}`));
    log('');
  } else {
    log(statusLine('No native host manifests found to uninstall.', 'info'));
    log('');
    log(dim(`To install: ${code('claude-chrome-mcp --install')}`));
    log('');
  }
}

/**
 * Check if native host is installed
 */
export function isNativeHostInstalled(): boolean {
  const manifestFilename = `${MANIFEST_NAME}.json`;
  const dirs = getNativeMessagingDirs();

  for (const dir of dirs) {
    const manifestPath = path.join(dir, manifestFilename);
    if (fs.existsSync(manifestPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if auth token is configured in wrapper script
 */
function hasAuthToken(wrapperDir: string): boolean {
  try {
    const wrapperPath = process.platform === 'win32'
      ? path.join(wrapperDir, 'claude-chrome-mcp-native-host.bat')
      : path.join(wrapperDir, 'claude-chrome-mcp-native-host');
    
    if (!fs.existsSync(wrapperPath)) return false;
    
    const content = fs.readFileSync(wrapperPath, 'utf8');
    
    // Check for environment variable in wrapper script
    // Look for MCP_AUTH_TOKEN with a non-empty value
    const hasToken = content.includes('MCP_AUTH_TOKEN');
    const isEmpty = content.includes('MCP_AUTH_TOKEN=""') || 
                   content.includes('MCP_AUTH_TOKEN=\'\'') ||
                   content.match(/MCP_AUTH_TOKEN=\s*$/m);  // Empty value
    
    return hasToken && !isEmpty;
  } catch {
    return false;
  }
}

/**
 * Read auth token from wrapper script
 */
function readAuthToken(wrapperDir: string): string | undefined {
  try {
    const wrapperPath = process.platform === 'win32'
      ? path.join(wrapperDir, 'claude-chrome-mcp-native-host.bat')
      : path.join(wrapperDir, 'claude-chrome-mcp-native-host');
    
    if (!fs.existsSync(wrapperPath)) return undefined;
    
    const content = fs.readFileSync(wrapperPath, 'utf8');
    
    // Parse token from wrapper script
    // Windows: set MCP_AUTH_TOKEN=token
    // Unix: export MCP_AUTH_TOKEN="token"
    const match = content.match(/MCP_AUTH_TOKEN[=\s]+"?([^"\s\n\r]+)"?/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get port from wrapper script
 */
function getConfiguredPort(wrapperDir: string): number | undefined {
  try {
    const wrapperPath = process.platform === 'win32'
      ? path.join(wrapperDir, 'claude-chrome-mcp-native-host.bat')
      : path.join(wrapperDir, 'claude-chrome-mcp-native-host');
    
    if (!fs.existsSync(wrapperPath)) return undefined;
    
    const content = fs.readFileSync(wrapperPath, 'utf8');
    const match = content.match(/MCP_PORT[=\s]+(\d+)/);
    return match ? parseInt(match[1], 10) : 3456;
  } catch {
    return undefined;
  }
}

/**
 * Get runtime from wrapper script
 */
function getConfiguredRuntime(wrapperDir: string): string | undefined {
  try {
    const wrapperPath = process.platform === 'win32'
      ? path.join(wrapperDir, 'claude-chrome-mcp-native-host.bat')
      : path.join(wrapperDir, 'claude-chrome-mcp-native-host');
    
    if (!fs.existsSync(wrapperPath)) return undefined;
    
    const content = fs.readFileSync(wrapperPath, 'utf8');
    if (content.includes('/bun')) return 'bun';
    if (content.includes('\\bun')) return 'bun';
    return 'node';
  } catch {
    return undefined;
  }
}

/**
 * Get information about the current installation
 */
export function getInstallationInfo(): {
  installed: boolean;
  manifests: string[];
  wrapperDir: string;
  wrapperExists: boolean;
  authTokenConfigured: boolean;
  authToken: string | undefined;
  port: number | undefined;
  runtime: string | undefined;
} {
  const manifestFilename = `${MANIFEST_NAME}.json`;
  const dirs = getNativeMessagingDirs();
  const manifests: string[] = [];

  for (const dir of dirs) {
    const manifestPath = path.join(dir, manifestFilename);
    if (fs.existsSync(manifestPath)) {
      manifests.push(manifestPath);
    }
  }

  const wrapperDir = getWrapperDir();
  const wrapperExists = fs.existsSync(wrapperDir);
  const authTokenConfigured = wrapperExists && hasAuthToken(wrapperDir);
  const authToken = wrapperExists ? readAuthToken(wrapperDir) : undefined;
  const port = wrapperExists ? getConfiguredPort(wrapperDir) : undefined;
  const runtime = wrapperExists ? getConfiguredRuntime(wrapperDir) : undefined;

  return {
    installed: manifests.length > 0,
    manifests,
    wrapperDir,
    wrapperExists,
    authTokenConfigured,
    authToken,
    port,
    runtime,
  };
}
