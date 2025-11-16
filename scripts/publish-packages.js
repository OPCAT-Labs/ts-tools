#!/usr/bin/env node

/**
 * Publish packages to npm
 * Usage: node scripts/publish-packages.js <tag>
 * Example: node scripts/publish-packages.js beta
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get tag argument
const [tag] = process.argv.slice(2);

if (!tag) {
  console.error('Usage: node scripts/publish-packages.js <tag>');
  console.error('Example: node scripts/publish-packages.js beta');
  process.exit(1);
}

// Packages to publish (all packages in packages/ directory)
const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter(dir => {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  return fs.existsSync(packageJsonPath);
});

console.log(`📦 Publishing packages to npm with tag: ${tag}\n`);

const published = [];
const failed = [];

for (const dir of packageDirs) {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Skip private packages
  if (packageJson.private) {
    console.log(`⏭️  Skipping private package: ${packageJson.name || dir}\n`);
    continue;
  }

  const packageName = packageJson.name;
  const version = packageJson.version;
  const packagePath = path.join(packagesDir, dir);

  console.log(`📤 Publishing ${packageName}@${version}...`);

  try {
    // Publish to npm
    execSync(`npm publish --tag ${tag} --access public`, {
      cwd: packagePath,
      stdio: 'inherit'
    });

    console.log(`✅ Successfully published ${packageName}@${version}\n`);
    published.push(`${packageName}@${version}`);
  } catch (error) {
    console.error(`❌ Failed to publish ${packageName}@${version}`);
    console.error(`   Error: ${error.message}\n`);
    failed.push(`${packageName}@${version}`);
  }
}

// Print summary
console.log('\n' + '='.repeat(60));
console.log('📊 PUBLISH SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Successfully published: ${published.length}`);
if (published.length > 0) {
  published.forEach(pkg => console.log(`   - ${pkg}`));
}

if (failed.length > 0) {
  console.log(`\n❌ Failed to publish: ${failed.length}`);
  failed.forEach(pkg => console.log(`   - ${pkg}`));
  console.log();
  process.exit(1);
} else {
  console.log('\n🎉 All packages published successfully!');
  process.exit(0);
}
