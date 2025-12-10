#!/usr/bin/env tsx
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { updateContractDesc } from './updateContractDesc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Cleans up intermediate compilation files.
 * Removes .map, .tpl, .transformer.json files and the .templates directory.
 */
function cleanupIntermediateFiles(): void {
  const assetsDir = path.join(__dirname, '../assets');

  console.log('Cleaning up intermediate files...');

  try {
    // Remove .templates directory (contains .map, .tpl, .transformer.json files)
    const templatesDir = path.join(assetsDir, '.templates');
    if (fs.existsSync(templatesDir)) {
      fs.rmSync(templatesDir, { recursive: true, force: true });
      console.log('✓ Removed .templates directory');
    }

    // Also clean up any standalone intermediate files in assets
    cleanupDirectory(assetsDir, ['.map', '.tpl', '.transformer.json', '.dbg', '.ast', '.hex']);

  } catch (error) {
    console.warn('⚠ Warning: Failed to clean up some intermediate files:', (error as Error).message);
  }
}

/**
 * Recursively removes files with specified extensions from a directory.
 * @param dir - Directory to clean
 * @param extensions - Array of file extensions to remove (e.g., ['.map', '.tpl'])
 */
function cleanupDirectory(dir: string, extensions: string[]): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      cleanupDirectory(fullPath, extensions);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        fs.unlinkSync(fullPath);
      }
    }
  }
}

const contractName = process.argv[2];

if (!contractName) {
  console.error('Usage: npm run gen:contract <ContractName>');
  console.error('Example: npm run gen:contract Genesis');
  process.exit(1);
}

console.log(`Compiling ${contractName}...`);

try {
  // 1. Compile single contract
  execSync(`npx tspc -p tsconfig.assets.json`, { stdio: 'inherit' });

  // 2. Update desc
  updateContractDesc(contractName);

  // 3. Cleanup intermediate files
  cleanupIntermediateFiles();

  console.log(`✓ Successfully generated ${contractName}`);
} catch (error) {
  console.error(`✗ Failed to generate ${contractName}:`, (error as Error).message);
  process.exit(1);
}
