/**
 * Native Host Manifest Installation
 * 
 * Creates the native messaging host manifest for Chrome/Chromium.
 * The manifest tells Chrome how to launch the native host process.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { DEFAULT_EXTENSION_ID, MANIFEST_NAME } from './constants.js';

export interface InstallOptions {
  extensionId?: string;
  verbose?: boolean;
  port?: number;
  authToken?: string;
  corsOrigins?: string[];
}

type Runtime = 'bun' | 'node';

interface RuntimeInfo {
  runtime: Runtime;
  execPath: string;
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
  
  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  log('Installing Claude Chrome MCP native host...');
  log(`Extension ID: ${extensionId}`);

  // Detect runtime
  const runtimeInfo = detectRuntime();
  log(`Runtime: ${runtimeInfo.runtime} (${runtimeInfo.execPath})`);

  // Security configuration summary
  if (options.authToken) {
    log('Security: Bearer token authentication enabled');
  } else {
    log('');
    log('⚠️  WARNING: No authentication configured!');
    log('   Anyone with access to localhost can control your browser.');
    log('   Use --auth-token to enable authentication.');
    log('');
  }
  
  if (options.corsOrigins && options.corsOrigins.length > 0) {
    log(`CORS: ${options.corsOrigins.join(', ')}`);
  } else {
    log('CORS: localhost only (default)');
  }
  
  if (options.port) {
    log(`Port: ${options.port}`);
  } else {
    log('Port: 3456 (default)');
  }

  // Create wrapper directory
  const wrapperDir = getWrapperDir();
  if (!fs.existsSync(wrapperDir)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
    log(`Created wrapper directory: ${wrapperDir}`);
  }

  // Create wrapper script
  const scriptPath = getExecutablePath();
  const wrapperPath = createWrapperScript(wrapperDir, scriptPath, runtimeInfo, options);
  log(`Created wrapper script: ${wrapperPath}`);

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
      log(`Installed manifest: ${manifestPath}`);
      installed = true;
    } catch (err) {
      console.error(`Failed to write manifest to ${manifestPath}:`, err);
    }
  }

  if (!installed) {
    console.error('No Chrome/Chromium installations found. Please install Chrome first.');
    process.exit(1);
  }

  log('');
  log('Installation complete!');
  log('');
  log('Next steps:');
  log('1. Restart Chrome/Chromium completely (quit and reopen)');
  log('2. The native host will start automatically when the extension connects');
  
  const port = options.port || 3456;
  const mcpUrl = `http://localhost:${port}/mcp`;
  log(`3. Configure your MCP client to use: ${mcpUrl}`);
  
  if (options.authToken) {
    log('');
    log('⚠️  IMPORTANT: Your MCP client must include the bearer token:');
    log('   Add this to your MCP client configuration:');
    log('   "headers": { "Authorization": "Bearer <your-token>" }');
  }
  
  log('');
  log('MCP client configuration example:');
  
  const exampleConfig: Record<string, unknown> = {
    mcpServers: {
      'claude_chrome': {
        transport: {
          type: 'http',
          url: mcpUrl,
        },
      },
    },
  };
  
  if (options.authToken) {
    (exampleConfig.mcpServers as Record<string, unknown>)['claude_chrome'] = {
      transport: {
        type: 'http',
        url: mcpUrl,
        headers: {
          Authorization: 'Bearer YOUR_AUTH_TOKEN_HERE',
        },
      },
    };
  }
  
  log(JSON.stringify(exampleConfig, null, 2));
  
  if (!options.authToken) {
    log('');
    log('⚠️  Security Warning: No authentication configured!');
    log('   To add authentication, reinstall with:');
    log('   claude-chrome-mcp --install --auth-token "your-secret-token"');
  }
}

/**
 * Uninstall the native host manifest
 */
export async function uninstallNativeHost(options: { verbose?: boolean } = {}): Promise<void> {
  const verbose = options.verbose ?? true;
  
  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  log('Uninstalling Claude Chrome MCP native host...');

  const manifestFilename = `${MANIFEST_NAME}.json`;
  const dirs = getNativeMessagingDirs();
  let uninstalled = false;

  for (const dir of dirs) {
    const manifestPath = path.join(dir, manifestFilename);
    if (fs.existsSync(manifestPath)) {
      try {
        fs.unlinkSync(manifestPath);
        log(`Removed manifest: ${manifestPath}`);
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
      log(`Removed wrapper directory: ${wrapperDir}`);
    } catch (err) {
      console.error(`Failed to remove wrapper directory:`, err);
    }
  }

  if (uninstalled) {
    log('');
    log('Uninstallation complete!');
    log('Please restart Chrome/Chromium for changes to take effect.');
  } else {
    log('No native host manifests found to uninstall.');
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
 * Get information about the current installation
 */
export function getInstallationInfo(): {
  installed: boolean;
  manifests: string[];
  wrapperDir: string;
  wrapperExists: boolean;
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

  return {
    installed: manifests.length > 0,
    manifests,
    wrapperDir,
    wrapperExists,
  };
}
