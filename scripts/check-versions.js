#!/usr/bin/env node

/**
 * Check if a specific version exists on npm for all public packages
 * Usage: node scripts/check-versions.js <full-version>
 *
 * Where full_version is the complete version string to check.
 *
 * Examples:
 *   node scripts/check-versions.js 1.0.5-beta-a1b2c3d4-20241116
 *   node scripts/check-versions.js 2.0.0-rc-9e83e4c0-20241117
 *
 * Returns exit code 1 if any package@version already exists, 0 otherwise
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get full_version argument
const [fullVersion] = process.argv.slice(2);

if (!fullVersion) {
  console.error('Error: Missing required argument');
  console.error('');
  console.error('Usage: node scripts/check-versions.js <full-version>');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/check-versions.js 1.0.5-beta-a1b2c3d4-20241116');
  console.error('  node scripts/check-versions.js 2.0.0-rc-9e83e4c0-20241117');
  console.error('');
  process.exit(1);
}

console.log(`🔍 Checking if version ${fullVersion} exists on npm...\n`);

// Packages to check (all packages in packages/ directory)
const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter(dir => {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  return fs.existsSync(packageJsonPath);
});

let hasExistingVersion = false;
const existingPackages = [];
const readyPackages = [];

for (const dir of packageDirs) {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Skip private packages
  if (packageJson.private) {
    continue;
  }

  const packageName = packageJson.name;

  try {
    // Check if this specific version exists on npm
    const result = execSync(`npm view ${packageName}@${fullVersion} version`, {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();

    if (result === fullVersion) {
      console.error(`❌ ${packageName}@${fullVersion} already exists on npm`);
      hasExistingVersion = true;
      existingPackages.push(`${packageName}@${fullVersion}`);
    }
  } catch (error) {
    // If npm view returns error, the version doesn't exist (which is what we want)
    console.log(`✅ ${packageName}@${fullVersion} - ready to publish`);
    readyPackages.push(`${packageName}@${fullVersion}`);
  }
}

console.log();

if (hasExistingVersion) {
  console.error('❌ ERROR: The following packages already exist on npm:');
  existingPackages.forEach(pkg => console.error(`   - ${pkg}`));
  console.error('\nThis version has already been published.');
  console.error('Please use a different version or commit.\n');
  process.exit(1);
} else {
  console.log(`✅ All packages are ready to publish as version ${fullVersion}!`);
  console.log(`\n📦 Packages to publish (${readyPackages.length}):`);
  readyPackages.forEach(pkg => console.log(`   - ${pkg}`));
  console.log();
  process.exit(0);
}
