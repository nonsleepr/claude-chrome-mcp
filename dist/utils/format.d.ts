/**
 * CLI formatting utilities with Chalk
 */
/**
 * Detect if colors should be disabled
 * - NO_COLOR environment variable set
 * - Output is not a TTY (piped)
 */
export declare const supportsColor: boolean;
export declare const title: (text: string) => string;
export declare const section: (text: string) => string;
export declare const subsection: (text: string) => string;
export declare const success: (text: string) => string;
export declare const error: (text: string) => string;
export declare const warning: (text: string) => string;
export declare const info: (text: string) => string;
export declare const secure: (text: string) => string;
export declare const insecure: (text: string) => string;
export declare const insecureWithBg: (text: string) => string;
export declare const code: (text: string) => string;
export declare const command: (text: string) => string;
export declare const path: (text: string) => string;
export declare const url: (text: string) => string;
export declare const dim: (text: string) => string;
export declare const value: (text: string) => string;
export declare const symbols: {
    success: string;
    error: string;
    warning: string;
    info: string;
};
/**
 * Format a progress/status line with appropriate symbol
 */
export declare function statusLine(message: string, status: 'success' | 'error' | 'warning' | 'info'): string;
/**
 * Format a labeled value line
 */
export declare function labelValue(label: string, valueText: string, indent?: number): string;
/**
 * Syntax highlight JSON output
 */
export declare function highlightJSON(obj: unknown): string;
/**
 * Format a multi-line warning block
 */
export declare function warningBlock(lines: string[]): string;
/**
 * Format a multi-line info block
 */
export declare function infoBlock(titleText: string, lines: string[]): string;
/**
 * Format a section header with blank line before
 */
export declare function sectionHeader(text: string): string;
/**
 * Format a subsection header
 */
export declare function subsectionHeader(text: string): string;
//# sourceMappingURL=format.d.ts.map