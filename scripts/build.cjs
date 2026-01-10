#!/usr/bin/env node

// Build script that can run in various contexts
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if we need to build
const distPath = path.join(__dirname, '..', 'dist');
const srcPath = path.join(__dirname, '..', 'src');

// If dist exists and src doesn't, we're probably in a published package - skip build
if (fs.existsSync(distPath) && !fs.existsSync(srcPath)) {
  console.log('Build already exists, skipping...');
  process.exit(0);
}

// If src doesn't exist at all, we can't build
if (!fs.existsSync(srcPath)) {
  console.log('No source files found, skipping build...');
  process.exit(0);
}

// Try to find tsc
const tscPaths = [
  path.join(__dirname, '..', 'node_modules', '.bin', 'tsc'),
  path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
];

let tscPath = null;
for (const p of tscPaths) {
  if (fs.existsSync(p)) {
    tscPath = p;
    break;
  }
}

if (!tscPath) {
  console.log('TypeScript compiler not found, skipping build...');
  process.exit(0);
}

// Run the build
try {
  console.log('Building TypeScript...');
  execSync(`node "${tscPath}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(0); // Don't fail the installation
}
