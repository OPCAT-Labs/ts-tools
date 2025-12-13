import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Updates the contract artifact descriptor in the source file.
 * @param contractName - Name of the contract (e.g., 'Genesis')
 */
export function updateContractDesc(contractName: string): void {
  try {
    // 1. Read artifact JSON
    const artifactPath = path.join(__dirname, '../test/fixtures', `${contractName.toLowerCase()}.json`);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Artifact not found: ${artifactPath}`);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // 2. Read source file
    const srcPath = path.join(__dirname, '../src/smart-contract/builtin-libs', `${contractName.toLowerCase()}.ts`);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source file not found: ${srcPath}`);
    }
    let content = fs.readFileSync(srcPath, 'utf8');

    // 3. Locate the desc constant definition
    // Match from "const desc = {" to the closing "};" before the loadArtifact call
    const regex = /const desc = \{[\s\S]*?\};/;
    const match = content.match(regex);
    if (!match) {
      throw new Error(`desc constant not found in ${srcPath}`);
    }

    // 4. Format artifact as TypeScript object literal
    const descString = formatArtifact(artifact);

    // 5. Replace the desc constant
    content = content.replace(regex, `const desc = ${descString};`);

    // 6. Write back
    fs.writeFileSync(srcPath, content, 'utf8');
    console.log(`✓ Updated desc for ${contractName}`);
  } catch (error) {
    console.error(`✗ Error updating desc for ${contractName}:`, (error as Error).message);
    throw error;
  }
}

/**
 * Formats artifact object as TypeScript code with proper indentation.
 * @param artifact - The artifact object from JSON
 * @returns Formatted TypeScript object literal
 */
function formatArtifact(artifact: any): string {
  // Maintain 2-space indentation, consistent with existing code style
  return JSON.stringify(artifact, null, 2)
    .replace(/"([^"]+)":/g, '$1:'); // Remove quotes from property names
}
