#!/usr/bin/env node

/**
 * Check if CHANGELOG.md files contain the version and it's the latest
 * Usage: node scripts/check-changelog.js <version>
 *
 * Examples:
 *   node scripts/check-changelog.js 1.0.5
 *
 * Returns exit code 1 if any CHANGELOG is missing the version or it's not the latest, 0 otherwise
 */

const fs = require('fs');
const path = require('path');

// Get version argument
const [expectedVersion] = process.argv.slice(2);

if (!expectedVersion) {
  console.error('Error: Missing required argument');
  console.error('');
  console.error('Usage: node scripts/check-changelog.js <version>');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/check-changelog.js 1.0.5');
  console.error('');
  process.exit(1);
}

console.log(`🔍 Checking if CHANGELOG.md files contain version ${expectedVersion} and it's the latest...\n`);

// Packages to check (all packages in packages/ directory)
const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter(dir => {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  return fs.existsSync(packageJsonPath);
});

let hasErrors = false;
const errors = [];
const verified = [];

for (const dir of packageDirs) {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Skip private packages
  if (packageJson.private) {
    console.log(`⏭️  ${packageJson.name} - skipped (private)`);
    continue;
  }

  const changelogPath = path.join(packagesDir, dir, 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    console.error(`❌ ${packageJson.name}: CHANGELOG.md not found`);
    hasErrors = true;
    errors.push(`${packageJson.name}: CHANGELOG.md not found`);
    continue;
  }

  const changelogContent = fs.readFileSync(changelogPath, 'utf8');

  // Check if version exists in CHANGELOG
  const versionRegex = new RegExp(`^## ${expectedVersion.replace(/\./g, '\\.')}$`, 'm');
  if (!versionRegex.test(changelogContent)) {
    console.error(`❌ ${packageJson.name}: Version ${expectedVersion} not found in CHANGELOG.md`);
    hasErrors = true;
    errors.push(`${packageJson.name}: Version ${expectedVersion} not found in CHANGELOG.md`);
    continue;
  }

  // Extract the first version from CHANGELOG (should be the latest)
  const firstVersionMatch = changelogContent.match(/^## (\d+\.\d+\.\d+)$/m);
  if (!firstVersionMatch) {
    console.error(`❌ ${packageJson.name}: No version found in CHANGELOG.md`);
    hasErrors = true;
    errors.push(`${packageJson.name}: No version found in CHANGELOG.md`);
    continue;
  }

  const latestVersion = firstVersionMatch[1];

  if (latestVersion !== expectedVersion) {
    console.error(`❌ ${packageJson.name}: Version ${expectedVersion} is not the latest in CHANGELOG.md (latest: ${latestVersion})`);
    hasErrors = true;
    errors.push(`${packageJson.name}: ${expectedVersion} is not latest (latest: ${latestVersion})`);
    continue;
  }

  console.log(`✅ ${packageJson.name}: Version ${expectedVersion} is in CHANGELOG.md and is the latest`);
  verified.push(packageJson.name);
}

console.log();

if (hasErrors) {
  console.error('❌ ERROR: CHANGELOG verification failed:');
  errors.forEach(err => console.error(`   - ${err}`));
  console.error('\nPlease ensure all CHANGELOGs are updated with the correct version.');
  console.error('You may need to run "changeset version" first.\n');
  process.exit(1);
} else {
  console.log(`✅ All CHANGELOGs contain version ${expectedVersion} and it's the latest!`);
  console.log(`\n📝 Verified CHANGELOGs (${verified.length}):`);
  verified.forEach(name => console.log(`   - ${name}`));
  console.log();
  process.exit(0);
}
