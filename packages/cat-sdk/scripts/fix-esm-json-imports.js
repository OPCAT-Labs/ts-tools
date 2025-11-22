/**
 * Post-process ESM output to add import attributes for JSON imports
 * TypeScript doesn't support import attributes syntax yet, so we need this post-process step
 */

const fs = require('fs');
const path = require('path');

const ESM_DIR = path.join(__dirname, '..', 'dist', 'esm');

function fixJsonImports(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      fixJsonImports(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf-8');

      // Add import attributes for JSON imports
      const newContent = content.replace(
        /(import\s+.+?\s+from\s+['"].*\.json['"])(?!.*\b(?:assert|with)\b)/g,
        (match) => `${match} with { type: 'json' }`
      );

      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf-8');
        console.log(`Fixed JSON imports: ${path.relative(ESM_DIR, fullPath)}`);
      }
    }
  }
}

console.log('Adding import attributes for JSON imports...\n');
fixJsonImports(ESM_DIR);
console.log('\nDone!');
