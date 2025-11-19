#!/usr/bin/env node

/**
 * Update package versions for prerelease
 * Usage: node scripts/update-version.js <full-version>
 *
 * Where full_version is the complete version string including prerelease info.
 *
 * Examples:
 *   node scripts/update-version.js 1.0.5-beta-a1b2c3d4-20241116
 *   node scripts/update-version.js 2.0.0-rc-9e83e4c0-20241117
 *   node scripts/update-version.js 1.5.0-alpha-abcd1234-20241115
 */

const fs = require('fs');
const path = require('path');

// Get full_version argument
const [fullVersion] = process.argv.slice(2);

if (!fullVersion) {
  console.error('Error: Missing required argument');
  console.error('');
  console.error('Usage: node scripts/update-version.js <full-version>');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/update-version.js 1.0.5-beta-a1b2c3d4-20241116');
  console.error('  node scripts/update-version.js 2.0.0-rc-9e83e4c0-20241117');
  console.error('  node scripts/update-version.js 1.5.0-alpha-abcd1234-20241115');
  console.error('');
  process.exit(1);
}

console.log(`📦 Updating all packages to version: ${fullVersion}\n`);

// Packages to update (all packages in packages/ directory)
const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter(dir => {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  return fs.existsSync(packageJsonPath);
});

// First pass: collect all package names and their new versions
const packageVersions = new Map();

console.log('📋 Collecting package information...\n');

for (const dir of packageDirs) {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Skip private packages
  if (packageJson.private) {
    console.log(`⏭️  Skipping private package: ${packageJson.name || dir}`);
    continue;
  }

  const originalVersion = packageJson.version;

  packageVersions.set(packageJson.name, {
    originalVersion,
    newVersion: fullVersion,
    packageJsonPath,
    packageJson
  });

  console.log(`✓ ${packageJson.name}`);
  console.log(`  ${originalVersion} → ${fullVersion}\n`);
}

// Second pass: update versions and dependencies
console.log('🔄 Updating package.json files...\n');

for (const [packageName, info] of packageVersions.entries()) {
  const { packageJson, packageJsonPath, newVersion } = info;

  // Update version
  packageJson.version = newVersion;

  // Update dependencies
  if (packageJson.dependencies) {
    for (const depName of Object.keys(packageJson.dependencies)) {
      if (packageVersions.has(depName)) {
        packageJson.dependencies[depName] = newVersion;
        console.log(`  Updated dependency: ${depName} → ${newVersion}`);
      }
    }
  }

  // Update devDependencies
  if (packageJson.devDependencies) {
    for (const depName of Object.keys(packageJson.devDependencies)) {
      if (packageVersions.has(depName)) {
        packageJson.devDependencies[depName] = newVersion;
        console.log(`  Updated devDependency: ${depName} → ${newVersion}`);
      }
    }
  }

  // Update peerDependencies
  if (packageJson.peerDependencies) {
    for (const depName of Object.keys(packageJson.peerDependencies)) {
      if (packageVersions.has(depName)) {
        packageJson.peerDependencies[depName] = newVersion;
        console.log(`  Updated peerDependency: ${depName} → ${newVersion}`);
      }
    }
  }

  // Write back to file
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated: ${packageName}\n`);
}

console.log('✨ All packages updated successfully!');
console.log(`\n📋 Summary:`);
console.log(`   Packages updated: ${packageVersions.size}`);
console.log(`   Full version: ${fullVersion}`);
