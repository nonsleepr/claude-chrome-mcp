#!/usr/bin/env bun

import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Execute shell command
 * @param {string} cmd - Command to execute
 * @param {boolean} silent - Suppress output
 * @returns {string} - Command output
 */
function exec(cmd, silent = false) {
  return execSync(cmd, {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: silent ? 'pipe' : 'inherit',
  });
}

/**
 * Execute shell command and capture output
 * @param {string} cmd - Command to execute
 * @returns {string} - Command output
 */
function execOutput(cmd) {
  return execSync(cmd, {
    cwd: projectRoot,
    encoding: 'utf-8',
  }).trim();
}

/**
 * Log with color
 */
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.cyan}${colors.bold}${msg}${colors.reset}`),
};

/**
 * Prompt user for input
 * @param {string} question - Question to ask
 * @returns {Promise<string>}
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}?${colors.reset} ${question} `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Bump version in package.json
 * @param {string} bumpType - Type of version bump (patch, minor, major)
 * @param {string} customVersion - Custom version string (if bump type is 'custom')
 * @returns {Promise<string>} - New version
 */
async function bumpVersion(bumpType, customVersion = null) {
  const pkgPath = join(projectRoot, 'package.json');
  const content = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(content);
  const currentVersion = pkg.version;
  
  let newVersion;
  
  if (bumpType === 'custom') {
    newVersion = customVersion;
  } else {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    switch (bumpType) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
      default:
        throw new Error(`Invalid bump type: ${bumpType}`);
    }
  }
  
  pkg.version = newVersion;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  
  return newVersion;
}

/**
 * Check if git working directory is clean
 * @returns {boolean}
 */
function isGitClean() {
  const status = execOutput('git status --porcelain');
  return status === '';
}

/**
 * Get current branch
 * @returns {string}
 */
function getCurrentBranch() {
  return execOutput('git rev-parse --abbrev-ref HEAD');
}

/**
 * Check if on main branch
 * @returns {boolean}
 */
function isOnMainBranch() {
  return getCurrentBranch() === 'main';
}

/**
 * Run pre-release checks
 * @param {boolean} dryRun - Dry run mode
 * @returns {Promise<boolean>}
 */
async function runPreReleaseChecks(dryRun) {
  log.step('Pre-release Checks');
  
  // Check git status
  if (!isGitClean()) {
    log.error('Git working directory is not clean');
    log.info('Please commit or stash your changes before releasing');
    return false;
  }
  log.success('Git working directory is clean');
  
  // Check branch
  if (!isOnMainBranch()) {
    log.warning(`Currently on branch: ${getCurrentBranch()}`);
    const answer = await prompt('Release should be done from main branch. Continue anyway? (y/N)');
    if (answer.toLowerCase() !== 'y') {
      return false;
    }
  } else {
    log.success('On main branch');
  }
  
  // Run tests
  log.info('Running tests...');
  try {
    exec('bun test', true);
    log.success('Tests passed');
  } catch (error) {
    log.error('Tests failed');
    return false;
  }
  
  // Check build
  log.info('Building project...');
  try {
    exec('bun run build', true);
    log.success('Build succeeded');
  } catch (error) {
    log.error('Build failed');
    return false;
  }
  
  return true;
}

/**
 * Get current version from package.json
 * @returns {Promise<string>}
 */
async function getCurrentVersion() {
  const pkgPath = join(projectRoot, 'package.json');
  const content = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(content);
  return pkg.version;
}

/**
 * Prompt for version bump type
 * @param {string} currentVersion - Current version
 * @returns {Promise<string>}
 */
async function promptForBumpType(currentVersion) {
  console.log(`\n${colors.bold}Current version: ${currentVersion}${colors.reset}`);
  console.log('  1) patch  (bug fixes)');
  console.log('  2) minor  (new features)');
  console.log('  3) major  (breaking changes)');
  console.log('  4) custom (specify version)');
  
  const answer = await prompt('Select version bump type (1-4):');
  
  switch (answer.trim()) {
    case '1':
      return 'patch';
    case '2':
      return 'minor';
    case '3':
      return 'major';
    case '4':
      return 'custom';
    default:
      log.error('Invalid selection');
      process.exit(1);
  }
}

/**
 * Main release function
 * @param {boolean} dryRun - Dry run mode
 */
async function release(dryRun = false) {
  if (dryRun) {
    log.warning('DRY RUN MODE - No changes will be made');
  }
  
  console.log(`\n${colors.bold}${colors.cyan}=== Release Process ===${colors.reset}\n`);
  
  // Pre-release checks
  const checksOk = await runPreReleaseChecks(dryRun);
  if (!checksOk) {
    log.error('Pre-release checks failed');
    process.exit(1);
  }
  
  // Get current version and prompt for bump
  const currentVersion = await getCurrentVersion();
  const bumpType = await promptForBumpType(currentVersion);
  
  let newVersion;
  
  if (dryRun) {
    // Calculate new version without modifying files
    if (bumpType === 'custom') {
      newVersion = await prompt('Enter new version:');
    } else {
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      switch (bumpType) {
        case 'major':
          newVersion = `${major + 1}.0.0`;
          break;
        case 'minor':
          newVersion = `${major}.${minor + 1}.0`;
          break;
        case 'patch':
          newVersion = `${major}.${minor}.${patch + 1}`;
          break;
      }
    }
    
    log.step(`Would release version ${newVersion}`);
    log.info('[DRY RUN] Would bump version in package.json');
    log.info('[DRY RUN] Would commit changes');
    log.info('[DRY RUN] Would create git tag');
    log.info('[DRY RUN] Would display push instructions');
    return;
  }
  
  // Actually bump version
  if (bumpType === 'custom') {
    const customVersion = await prompt('Enter new version:');
    newVersion = await bumpVersion(bumpType, customVersion);
  } else {
    newVersion = await bumpVersion(bumpType);
  }
  
  log.step(`Releasing version ${newVersion}`);
  log.success(`Version bumped to ${newVersion}`);
  
  // Stage changes
  log.info('Staging changes...');
  exec('git add package.json', true);
  
  // Commit
  log.info('Committing changes...');
  exec(`git commit -m "Release v${newVersion}"`, true);
  log.success('Changes committed');
  
  // Create tag
  log.info('Creating git tag...');
  exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`, true);
  log.success(`Tag v${newVersion} created`);
  
  console.log(`\n${colors.green}${colors.bold}Release v${newVersion} complete!${colors.reset}\n`);
  
  // Show next steps
  log.step('Next Steps:');
  console.log(`\n${colors.cyan}1. Push the release:${colors.reset}`);
  console.log(`   ${colors.bold}git push <remote> <branch>${colors.reset}       # Push the commit`);
  console.log(`   ${colors.bold}git push <remote> v${newVersion}${colors.reset}    # Push the tag`);
  
  console.log(`\n${colors.cyan}2. (Optional) Create a release on your hosting platform${colors.reset}`);
  console.log(`   For GitHub: ${colors.bold}gh release create v${newVersion} --generate-notes${colors.reset}`);
  console.log(`   For GitLab: Create release via web UI`);
  console.log(`   For Gitea: Create release via web UI`);
  
  console.log(`\n${colors.cyan}Examples:${colors.reset}`);
  console.log('   ' + colors.dim + '# Push to origin (e.g., GitHub)' + colors.reset);
  console.log('   ' + colors.dim + 'git push origin main && git push origin v' + newVersion + colors.reset);
  console.log('   ' + colors.dim + '# Push to different remote (e.g., GitLab, Gitea)' + colors.reset);
  console.log('   ' + colors.dim + 'git push upstream main && git push upstream v' + newVersion + colors.reset);
  console.log('');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  try {
    await release(dryRun);
  } catch (error) {
    log.error(`Release failed: ${error.message}`);
    process.exit(1);
  }
}

main();
