#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileContract } from '@opcat-labs/scrypt-ts-transpiler-opcat';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageDir = path.join(__dirname, '..');
const fixturesDir = path.join(packageDir, 'test/fixtures');

// Map fixture file names to their scrypt source locations
const fixtureToScryptMap: Record<string, string> = {
  // Builtin libs from assets
  'genesis.json': 'assets/smart-contract/builtin-libs/genesis.scrypt',
  'backtrace.json': 'assets/smart-contract/builtin-libs/backtrace.scrypt',
  'p2pkh.json': 'assets/smart-contract/builtin-libs/p2pkh.scrypt',
  // Test contracts
  'cltv.json': 'artifacts/test/contracts/cltv.scrypt',
  'checkDataSig.json': 'artifacts/test/contracts/checkDataSig.scrypt',
  'stateMethods.json': 'artifacts/test/contracts/stateMethods.scrypt',
  'demoWithTags.json': 'artifacts/test/contracts/demoWithTags.scrypt',
  'b2GCounter.json': 'artifacts/test/contracts/b2GCounter.scrypt',
  'counter.json': 'artifacts/test/contracts/counter.scrypt',
};

async function main() {
  for (const [fixtureFileName, scryptPath] of Object.entries(fixtureToScryptMap)) {
    const fixturePath = path.join(fixturesDir, fixtureFileName);
    const scryptFilePath = path.join(packageDir, scryptPath);

    if (!fs.existsSync(fixturePath)) {
      console.log(`Skipping ${fixtureFileName}: fixture file not found`);
      continue;
    }

    if (!fs.existsSync(scryptFilePath)) {
      console.log(`Skipping ${fixtureFileName}: scrypt file not found at ${scryptFilePath}`);
      continue;
    }

    try {
      console.log(`Compiling ${fixtureFileName} from ${scryptFilePath}...`);
      const result = compileContract(scryptFilePath, { artifact: true, optimize: true });
      const artifact = result.toArtifact();

      fs.writeFileSync(fixturePath, JSON.stringify(artifact, null, 2));
      console.log(`  Updated ${fixtureFileName}`);
    } catch (error) {
      console.error(`  Error compiling ${fixtureFileName}:`, error);
    }
  }

  console.log('Done compiling test contracts');
}

main().catch(console.error);
