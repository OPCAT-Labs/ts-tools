/**
 * ESM Import Test for cat-sdk
 *
 * This test verifies that cat-sdk can be properly imported as an ESM module.
 * Run with: node test.mjs
 */

console.log('Testing cat-sdk ESM import...\n');

// Test 1: Package import (most important - real-world usage)
console.log('Test 1: Importing as package (@opcat-labs/cat-sdk)...');
try {
  const catSdk = await import('@opcat-labs/cat-sdk');
  console.log('✓ Package import successful');
  console.log('  Exported keys:', Object.keys(catSdk).slice(0, 10).join(', '), '...');
} catch (error) {
  console.log('✗ Package import failed:', error.message);
  console.log('  Full error:', error);
}

// Test 2: Named exports from package
console.log('\nTest 2: Testing named exports from package...');
try {
  const {
    CAT20,
    CAT721,
    CAT20OpenMinter,
    CAT721OpenMinter,
  } = await import('@opcat-labs/cat-sdk');

  console.log('✓ Named exports from package successful');
  console.log('  CAT20:', typeof CAT20);
  console.log('  CAT721:', typeof CAT721);
  console.log('  CAT20OpenMinter:', typeof CAT20OpenMinter);
  console.log('  CAT721OpenMinter:', typeof CAT721OpenMinter);
} catch (error) {
  console.log('✗ Named exports from package failed:', error.message);
  console.log('  Full error:', error);
}

// Test 3: Direct file import (for internal verification)
console.log('\nTest 3: Importing from direct file path...');
try {
  const catSdk = await import('../dist/esm/index.js');
  console.log('✓ Direct file import successful');
  console.log('  Exported keys:', Object.keys(catSdk).slice(0, 10).join(', '), '...');
} catch (error) {
  console.log('✗ Direct file import failed:', error.message);
  console.log('  Full error:', error);
}

// Test 4: Sub-path imports (if supported)
console.log('\nTest 4: Testing sub-path imports...');
try {
  const utils = await import('../dist/esm/utils/index.js');
  console.log('✓ Utils sub-path import successful');
  console.log('  Exported keys:', Object.keys(utils).slice(0, 5).join(', '), '...');
} catch (error) {
  console.log('✗ Utils sub-path import failed:', error.message);
}

// Test 5: Check for proper ESM module syntax
console.log('\nTest 5: Verifying ESM module format...');
try {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const esmIndexPath = path.join(__dirname, '../dist/esm/index.js');
  const content = fs.readFileSync(esmIndexPath, 'utf-8');

  const hasExportStar = content.includes('export *');
  const hasRequire = content.includes('require(');
  const hasModuleExports = content.includes('module.exports');

  console.log('  Has export * syntax:', hasExportStar ? '✓' : '✗');
  console.log('  Has require() calls:', hasRequire ? '✗ (should not have)' : '✓');
  console.log('  Has module.exports:', hasModuleExports ? '✗ (should not have)' : '✓');

  if (hasExportStar && !hasRequire && !hasModuleExports) {
    console.log('✓ ESM format verification passed');
  } else {
    console.log('✗ ESM format verification failed');
  }
} catch (error) {
  console.log('✗ ESM format verification failed:', error.message);
}

// Test 6: Check for missing .js extensions in imports (common ESM issue)
console.log('\nTest 6: Checking for potential extension issues...');
try {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const esmIndexPath = path.join(__dirname, '../dist/esm/index.js');
  const content = fs.readFileSync(esmIndexPath, 'utf-8');

  // Check if imports have .js extensions
  const importMatches = content.match(/from ['"]\.\/[^'"]+['"]/g) || [];
  const importsWithoutExtension = importMatches.filter(imp => !imp.includes('.js'));

  if (importsWithoutExtension.length > 0) {
    console.log('⚠ Found imports without .js extension:');
    importsWithoutExtension.forEach(imp => console.log('    ', imp));
    console.log('  This may cause issues in strict ESM environments');
  } else {
    console.log('✓ All relative imports have .js extensions');
  }
} catch (error) {
  console.log('✗ Extension check failed:', error.message);
}

// Test 7: Test actual functionality from package
console.log('\nTest 7: Testing actual functionality from package...');
try {
  const { CAT20, CAT20OpenMinter } = await import('@opcat-labs/cat-sdk');

  console.log('✓ Functionality test passed');
  console.log('  CAT20 constructor available:', typeof CAT20 === 'function');
  console.log('  CAT20OpenMinter constructor available:', typeof CAT20OpenMinter === 'function');
} catch (error) {
  console.log('✗ Functionality test failed:', error.message);
  console.log('  Full error:', error);
}

console.log('\n=== ESM Import Test Complete ===\n');
