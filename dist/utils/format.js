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
export const title = (text) => chalk.bold.white(text);
export const section = (text) => chalk.bold.cyan(text);
export const subsection = (text) => chalk.bold.white(text);
export const success = (text) => chalk.green(text);
export const error = (text) => chalk.red(text);
export const warning = (text) => chalk.yellow(text);
export const info = (text) => chalk.blue(text);
export const secure = (text) => chalk.green(text);
export const insecure = (text) => chalk.bold.red(text);
export const insecureWithBg = (text) => chalk.bgRed.white.bold(` ${text} `);
export const code = (text) => chalk.cyan(text);
export const command = (text) => chalk.cyan(text);
export const path = (text) => chalk.dim(text);
export const url = (text) => chalk.cyan(text);
export const dim = (text) => chalk.dim(text);
export const value = (text) => chalk.yellow(text);
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
export function statusLine(message, status) {
    const symbol = symbols[status];
    return `  ${symbol} ${message}`;
}
/**
 * Format a labeled value line
 */
export function labelValue(label, valueText, indent = 0) {
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
export function highlightJSON(obj) {
    const json = JSON.stringify(obj, null, 2);
    // Split into lines and colorize each line
    return json.split('\n').map(line => {
        // Color keys (property names followed by colon)
        let coloredLine = line.replace(/"([^"]+)":/g, (match, key) => {
            return chalk.cyan(`"${key}"`) + ':';
        });
        // Color string values (after colon)
        coloredLine = coloredLine.replace(/: "([^"]+)"/g, (match, val) => {
            return ': ' + chalk.yellow(`"${val}"`);
        });
        // Color structural characters
        coloredLine = coloredLine.replace(/^(\s*)([{}[\],])/g, (match, spaces, char) => {
            return spaces + chalk.dim(char);
        });
        return coloredLine;
    }).join('\n');
}
// ============================================================================
// Warning/Alert Blocks
// ============================================================================
/**
 * Format a multi-line warning block
 */
export function warningBlock(lines) {
    const header = warning('[!] SECURITY WARNING');
    const body = lines.map(line => '    ' + line).join('\n');
    return `\n${header}\n${body}\n`;
}
/**
 * Format a multi-line info block
 */
export function infoBlock(titleText, lines) {
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
export function sectionHeader(text) {
    return `\n${section(text)}`;
}
/**
 * Format a subsection header
 */
export function subsectionHeader(text) {
    return subsection(text);
}
//# sourceMappingURL=format.js.map