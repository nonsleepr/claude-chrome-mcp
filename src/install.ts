/**
 * Native Host Manifest Installation
 * 
 * Creates the native messaging host manifest for Chrome/Chromium.
 * The manifest tells Chrome how to launch the native host process.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_EXTENSION_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn';
const MANIFEST_NAME = 'com.anthropic.claude_code_browser_extension';

export interface InstallOptions {
  extensionId?: string;
  verbose?: boolean;
}

/**
 * Get the path to the native host executable
 */
function getExecutablePath(): string {
  // When installed globally via npm, this script runs from dist/cli.js
  // We need to return the path to the installed binary
  
  // Check if we're running from node_modules (global install)
  const scriptPath = process.argv[1];
  
  // If running via npx or global install, the binary is the script itself
  // We need to create a wrapper or use node directly
  
  // For cross-platform compatibility, we'll use the node executable with the script
  return scriptPath;
}

/**
 * Create a wrapper script for the native host
 */
function createWrapperScript(targetDir: string, scriptPath: string): string {
  const wrapperPath = path.join(targetDir, 'claude-chrome-mcp-native-host');
  
  if (process.platform === 'win32') {
    // Windows batch file
    const batchPath = wrapperPath + '.bat';
    const content = `@echo off\r\n"${process.execPath}" "${scriptPath}" %*\r\n`;
    fs.writeFileSync(batchPath, content);
    return batchPath;
  } else {
    // Unix shell script
    const nodeExec = process.execPath;
    const content = `#!/usr/bin/env bash\nexec "${nodeExec}" "${scriptPath}" "$@"\n`;
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

  // Create wrapper directory
  const wrapperDir = getWrapperDir();
  if (!fs.existsSync(wrapperDir)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
    log(`Created wrapper directory: ${wrapperDir}`);
  }

  // Create wrapper script
  const scriptPath = getExecutablePath();
  const wrapperPath = createWrapperScript(wrapperDir, scriptPath);
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
  log('3. Configure your MCP client to use: http://localhost:3456/mcp');
  log('');
  log('MCP client configuration example:');
  log(JSON.stringify({
    mcpServers: {
      'chrome-browser': {
        transport: {
          type: 'sse',
          url: 'http://localhost:3456/mcp',
        },
      },
    },
  }, null, 2));
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
