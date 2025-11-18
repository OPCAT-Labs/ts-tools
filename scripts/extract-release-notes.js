#!/usr/bin/env node

/**
 * Extract release notes from CHANGELOG.md files for a specific version
 * Usage: node scripts/extract-release-notes.js <version>
 *
 * Examples:
 *   node scripts/extract-release-notes.js 1.0.5
 *
 * Outputs the combined release notes to stdout
 */

const fs = require('fs');
const path = require('path');

// Get version argument
const [version] = process.argv.slice(2);

if (!version) {
  console.error('Error: Missing required argument');
  console.error('');
  console.error('Usage: node scripts/extract-release-notes.js <version>');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/extract-release-notes.js 1.0.5');
  console.error('');
  process.exit(1);
}

// Packages to check (all packages in packages/ directory)
const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter(dir => {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  return fs.existsSync(packageJsonPath);
});

const releaseNotes = [];
const packageChanges = new Map();

for (const dir of packageDirs) {
  const packageJsonPath = path.join(packagesDir, dir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Skip private packages
  if (packageJson.private) {
    continue;
  }

  const changelogPath = path.join(packagesDir, dir, 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    continue;
  }

  const changelogContent = fs.readFileSync(changelogPath, 'utf8');

  // Extract content for the specific version
  const versionRegex = new RegExp(
    `^## ${version.replace(/\./g, '\\.')}$\\n([\\s\\S]*?)(?=^## \\d+\\.\\d+\\.\\d+$|$)`,
    'm'
  );

  const match = changelogContent.match(versionRegex);

  if (match && match[1]) {
    const content = match[1].trim();
    if (content) {
      packageChanges.set(packageJson.name, content);
    }
  }
}

// Generate combined release notes
if (packageChanges.size === 0) {
  console.log(`## Version ${version}\n\nNo changes documented.`);
  process.exit(0);
}

// Group changes by type (Major, Minor, Patch)
const majorChanges = [];
const minorChanges = [];
const patchChanges = [];
const otherChanges = [];

for (const [packageName, content] of packageChanges.entries()) {
  // Determine change type from content
  if (content.includes('### Major Changes')) {
    majorChanges.push({ package: packageName, content });
  } else if (content.includes('### Minor Changes')) {
    minorChanges.push({ package: packageName, content });
  } else if (content.includes('### Patch Changes')) {
    patchChanges.push({ package: packageName, content });
  } else {
    otherChanges.push({ package: packageName, content });
  }
}

// Build the release notes
let output = `## Version ${version}\n\n`;

// Add major changes
if (majorChanges.length > 0) {
  output += `### 🚀 Major Changes\n\n`;
  majorChanges.forEach(({ packageName, content }) => {
    output += `**${packageName}**\n\n`;
    // Extract only the Major Changes section
    const majorMatch = content.match(/### Major Changes\n([\s\S]*?)(?=###|$)/);
    if (majorMatch) {
      output += majorMatch[1].trim() + '\n\n';
    }
  });
}

// Add minor changes
if (minorChanges.length > 0) {
  output += `### ✨ Minor Changes\n\n`;
  minorChanges.forEach(({ package: packageName, content }) => {
    output += `**${packageName}**\n\n`;
    // Extract only the Minor Changes section
    const minorMatch = content.match(/### Minor Changes\n([\s\S]*?)(?=###|$)/);
    if (minorMatch) {
      output += minorMatch[1].trim() + '\n\n';
    }
  });
}

// Add patch changes
if (patchChanges.length > 0) {
  output += `### 🐛 Patch Changes\n\n`;
  patchChanges.forEach(({ package: packageName, content }) => {
    output += `**${packageName}**\n\n`;
    // Extract only the Patch Changes section
    const patchMatch = content.match(/### Patch Changes\n([\s\S]*?)(?=###|$)/);
    if (patchMatch) {
      output += patchMatch[1].trim() + '\n\n';
    }
  });
}

// Add other changes
if (otherChanges.length > 0) {
  output += `### 📦 Other Changes\n\n`;
  otherChanges.forEach(({ package: packageName, content }) => {
    output += `**${packageName}**\n\n${content}\n\n`;
  });
}

// Add footer
output += `---\n\n`;
output += `**Full Changelog**: https://github.com/${process.env.GITHUB_REPOSITORY || 'OWNER/REPO'}/compare/v${getPreviousVersion(version)}...v${version}\n`;

console.log(output);

function getPreviousVersion(version) {
  const parts = version.split('.');
  const patch = parseInt(parts[2]);
  if (patch > 0) {
    parts[2] = (patch - 1).toString();
  } else {
    const minor = parseInt(parts[1]);
    if (minor > 0) {
      parts[1] = (minor - 1).toString();
      parts[2] = '0';
    } else {
      const major = parseInt(parts[0]);
      if (major > 0) {
        parts[0] = (major - 1).toString();
        parts[1] = '0';
        parts[2] = '0';
      }
    }
  }
  return parts.join('.');
}
