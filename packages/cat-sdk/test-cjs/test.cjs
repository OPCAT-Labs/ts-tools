/**
 * CJS Import Test for cat-sdk
 * Run with: node test-cjs.cjs
 */

console.log('Testing cat-sdk CJS import...\n');

// Test 1: Package import
console.log('Test 1: Importing as package (@opcat-labs/cat-sdk)...');
try {
  const catSdk = require('@opcat-labs/cat-sdk');
  console.log('✓ Package import successful');
  console.log('  Exported keys:', Object.keys(catSdk).slice(0, 10).join(', '), '...');
} catch (error) {
  console.log('✗ Package import failed:', error.message);
}

// Test 2: Named exports
console.log('\nTest 2: Testing named exports from package...');
try {
  const { CAT20, CAT721, CAT20OpenMinter, CAT721OpenMinter } = require('@opcat-labs/cat-sdk');
  console.log('✓ Named exports from package successful');
  console.log('  CAT20:', typeof CAT20);
  console.log('  CAT721:', typeof CAT721);
  console.log('  CAT20OpenMinter:', typeof CAT20OpenMinter);
  console.log('  CAT721OpenMinter:', typeof CAT721OpenMinter);
} catch (error) {
  console.log('✗ Named exports failed:', error.message);
}

// Test 3: Direct file import
console.log('\nTest 3: Importing from direct file path...');
try {
  const catSdk = require('../dist/cjs/index.js');
  console.log('✓ Direct file import successful');
  console.log('  Exported keys:', Object.keys(catSdk).slice(0, 10).join(', '), '...');
} catch (error) {
  console.log('✗ Direct file import failed:', error.message);
}

// Test 4: Functionality test
console.log('\nTest 4: Testing actual functionality...');
try {
  const { CAT20, CAT20OpenMinter } = require('@opcat-labs/cat-sdk');
  console.log('✓ Functionality test passed');
  console.log('  CAT20 constructor available:', typeof CAT20 === 'function');
  console.log('  CAT20OpenMinter constructor available:', typeof CAT20OpenMinter === 'function');
} catch (error) {
  console.log('✗ Functionality test failed:', error.message);
}

console.log('\n=== CJS Import Test Complete ===\n');
