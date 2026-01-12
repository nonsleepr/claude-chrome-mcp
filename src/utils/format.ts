/**
 * CLI formatting utilities with Chalk
 */

import chalk from 'chalk';

// ============================================================================
// Color Detection & Configuration
// ============================================================================

/**
 * Detect if colors should be disabled
 * - NO_COLOR environment variable set
 * - Output is not a TTY (piped)
 */
export const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;

// Configure chalk based on color support
if (!supportsColor) {
  chalk.level = 0;
}

// ============================================================================
// Semantic Color Functions
// ============================================================================

export const title = (text: string) => chalk.bold.white(text);
export const section = (text: string) => chalk.bold.cyan(text);
export const subsection = (text: string) => chalk.bold.white(text);

export const success = (text: string) => chalk.green(text);
export const error = (text: string) => chalk.red(text);
export const warning = (text: string) => chalk.yellow(text);
export const info = (text: string) => chalk.blue(text);
export const secure = (text: string) => chalk.green(text);
export const insecure = (text: string) => chalk.bold.red(text);
export const insecureWithBg = (text: string) => chalk.bgRed.white.bold(` ${text} `);

export const code = (text: string) => chalk.cyan(text);
export const command = (text: string) => chalk.cyan(text);
export const path = (text: string) => chalk.dim(text);
export const url = (text: string) => chalk.cyan(text);
export const dim = (text: string) => chalk.dim(text);
export const value = (text: string) => chalk.yellow(text);

// ============================================================================
// Status Symbols
// ============================================================================

export const symbols = {
  success: chalk.green('[✓]'),
  error: chalk.red('[✗]'),
  warning: chalk.yellow('[!]'),
  info: chalk.blue('[i]'),
};

// ============================================================================
// Progress/Status Lines
// ============================================================================

/**
 * Format a progress/status line with appropriate symbol
 */
export function statusLine(
  message: string, 
  status: 'success' | 'error' | 'warning' | 'info'
): string {
  const symbol = symbols[status];
  return `  ${symbol} ${message}`;
}

/**
 * Format a labeled value line
 */
export function labelValue(label: string, valueText: string, indent = 0): string {
  const spaces = ' '.repeat(indent);
  const paddedLabel = label.padEnd(15);
  return `${spaces}${dim(paddedLabel)} ${valueText}`;
}

// ============================================================================
// JSON Syntax Highlighting
// ============================================================================

/**
 * Syntax highlight JSON output
 */
export function highlightJSON(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  return json
    .replace(/"([^"]+)":/g, (_, key) => chalk.cyan(`"${key}"`) + ':')  // keys
    .replace(/: "([^"]+)"/g, (_, val) => ': ' + chalk.yellow(`"${val}"`))  // string values
    .replace(/([{}[\],])/g, (match) => chalk.dim(match));  // punctuation
}

// ============================================================================
// Warning/Alert Blocks
// ============================================================================

/**
 * Format a multi-line warning block
 */
export function warningBlock(lines: string[]): string {
  const header = warning('[!] SECURITY WARNING');
  const body = lines.map(line => '    ' + line).join('\n');
  return `\n${header}\n${body}\n`;
}

/**
 * Format a multi-line info block
 */
export function infoBlock(titleText: string, lines: string[]): string {
  const header = info(`[i] ${titleText}`);
  const body = lines.map(line => '    ' + line).join('\n');
  return `\n${header}\n${body}\n`;
}

// ============================================================================
// Section Formatters
// ============================================================================

/**
 * Format a section header with blank line before
 */
export function sectionHeader(text: string): string {
  return `\n${section(text)}`;
}

/**
 * Format a subsection header
 */
export function subsectionHeader(text: string): string {
  return subsection(text);
}
