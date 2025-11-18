#!/usr/bin/env node

/**
 * Check if all packages have the same version matching the tag version
 * Usage: node scripts/check-package-versions.js <version>
 *
 * Examples:
 *   node scripts/check-package-versions.js 1.0.5
 *
 * Returns exit code 1 if any package has a different version, 0 otherwise
 */

const fs = require('fs');
const path = require('path');

// Get version argument
const [expectedVersion] = process.argv.slice(2);

if (!expectedVersion) {
  console.error('Error: Missing required argument');
  console.error('');
  console.error('Usage: node scripts/check-package-versions.js <version>');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/check-package-versions.js 1.0.5');
  console.error('');
  process.exit(1);
}

console.log(`🔍 Checking if all packages have version ${expectedVersion}...\n`);

// Packages to check (all packages in packages/ directory)
const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter(dir => {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  return fs.existsSync(packageJsonPath);
});

let hasVersionMismatch = false;
const mismatchedPackages = [];
const matchedPackages = [];

for (const dir of packageDirs) {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Skip private packages
  if (packageJson.private) {
    console.log(`⏭️  ${packageJson.name} - skipped (private)`);
    continue;
  }

  const packageName = packageJson.name;
  const packageVersion = packageJson.version;

  if (packageVersion !== expectedVersion) {
    console.error(`❌ ${packageName}: version ${packageVersion} (expected ${expectedVersion})`);
    hasVersionMismatch = true;
    mismatchedPackages.push(`${packageName}: ${packageVersion} ≠ ${expectedVersion}`);
  } else {
    console.log(`✅ ${packageName}: version ${packageVersion}`);
    matchedPackages.push(`${packageName}@${packageVersion}`);
  }
}

console.log();

if (hasVersionMismatch) {
  console.error('❌ ERROR: Version mismatch detected:');
  mismatchedPackages.forEach(pkg => console.error(`   - ${pkg}`));
  console.error('\nAll packages must have the same version as the tag.');
  console.error('Please run "changeset version" to update package versions.\n');
  process.exit(1);
} else {
  console.log(`✅ All packages have version ${expectedVersion}!`);
  console.log(`\n📦 Verified packages (${matchedPackages.length}):`);
  matchedPackages.forEach(pkg => console.log(`   - ${pkg}`));
  console.log();
  process.exit(0);
}
