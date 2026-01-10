/**
 * Native Host Manifest Installation
 *
 * Creates the native messaging host manifest for Chrome/Chromium.
 * The manifest tells Chrome how to launch the native host process.
 */
export interface InstallOptions {
    extensionId?: string;
    verbose?: boolean;
    port?: number;
    authToken?: string;
    corsOrigins?: string[];
}
/**
 * Install the native host manifest
 */
export declare function installNativeHost(options?: InstallOptions): Promise<void>;
/**
 * Uninstall the native host manifest
 */
export declare function uninstallNativeHost(options?: {
    verbose?: boolean;
}): Promise<void>;
/**
 * Check if native host is installed
 */
export declare function isNativeHostInstalled(): boolean;
/**
 * Get information about the current installation
 */
export declare function getInstallationInfo(): {
    installed: boolean;
    manifests: string[];
    wrapperDir: string;
    wrapperExists: boolean;
};
//# sourceMappingURL=install.d.ts.map