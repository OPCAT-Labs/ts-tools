/**
 * Add .js extensions to all relative imports in TypeScript source files
 * This is the recommended approach for ESM compatibility
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

function addJsExtensionsToFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Pattern 0: Handle bare '.' or '..' imports first (directory index imports)
  content = content.replace(/(from\s+['"])(\.\.?)(['"])/g, (match, prefix, dir, suffix) => {
    modified = true;
    return `${prefix}${dir}/index.js${suffix}`;
  });

  // Pattern 1: from './path' or from '../path' (without extension)
  // Skip if already has .js, .json, or looks like a package import
  const importPattern = /(from\s+['"])(\.\.?\/[^'"]+)(?<!\.js)(?<!\.json)(['"])/g;

  const newContent = content.replace(importPattern, (match, prefix, modulePath, suffix) => {
    // Skip if already has extension
    if (modulePath.endsWith('.js') || modulePath.endsWith('.json')) {
      return match;
    }

    // Check if this path exists as a file or directory
    const fileDir = path.dirname(filePath);
    const resolvedPath = path.resolve(fileDir, modulePath);
    const tsFile = resolvedPath + '.ts';
    const indexFile = path.join(resolvedPath, 'index.ts');

    // If it's a directory with index.ts, add /index.js
    if (fs.existsSync(indexFile)) {
      modified = true;
      return `${prefix}${modulePath}/index.js${suffix}`;
    }
    // If it's a file, add .js
    else if (fs.existsSync(tsFile)) {
      modified = true;
      return `${prefix}${modulePath}.js${suffix}`;
    }
    // If we can't find it, assume it's a file and add .js
    else {
      modified = true;
      return `${prefix}${modulePath}.js${suffix}`;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return true;
  }
  return false;
}

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      count += processDirectory(fullPath);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      if (addJsExtensionsToFile(fullPath)) {
        console.log(`Fixed: ${path.relative(SRC_DIR, fullPath)}`);
        count++;
      }
    }
  }

  return count;
}

console.log('Adding .js extensions to source imports...\n');
const count = processDirectory(SRC_DIR);
console.log(`\n✓ Updated ${count} files`);
