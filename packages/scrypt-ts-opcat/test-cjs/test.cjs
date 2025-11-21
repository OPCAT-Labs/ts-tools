/**
 * CJS Import Test for scrypt-ts-opcat
 */

console.log('Testing scrypt-ts-opcat CJS import...\n');

// Test 1: Package import
console.log('Test 1: Importing as package (@opcat-labs/scrypt-ts-opcat)...');
try {
  const scryptTs = require('@opcat-labs/scrypt-ts-opcat');
  console.log('✓ Package import successful');
  console.log('  Exported keys:', Object.keys(scryptTs).slice(0, 10).join(', '), '...');
} catch (error) {
  console.log('✗ Package import failed:', error.message);
}

// Test 2: Named exports
console.log('\nTest 2: Testing named exports from package...');
try {
  const { SmartContract, method, prop, assert, toByteString } = require('@opcat-labs/scrypt-ts-opcat');
  console.log('✓ Named exports from package successful');
  console.log('  SmartContract:', typeof SmartContract);
  console.log('  method:', typeof method);
  console.log('  prop:', typeof prop);
  console.log('  assert:', typeof assert);
  console.log('  toByteString:', typeof toByteString);
} catch (error) {
  console.log('✗ Named exports failed:', error.message);
}

// Test 3: Direct file import
console.log('\nTest 3: Importing from direct file path...');
try {
  const scryptTs = require('../dist/cjs/index.cjs');
  console.log('✓ Direct file import successful');
  console.log('  Exported keys:', Object.keys(scryptTs).slice(0, 10).join(', '), '...');
} catch (error) {
  console.log('✗ Direct file import failed:', error.message);
}

// Test 4: Functionality test
console.log('\nTest 4: Testing actual functionality...');
try {
  const { toByteString, int2ByteString, byteStringToInt } = require('@opcat-labs/scrypt-ts-opcat');
  const bs = toByteString('hello', true);
  console.log('✓ Functionality test passed');
  console.log('  toByteString("hello", true):', bs);
  console.log('  int2ByteString available:', typeof int2ByteString === 'function');
  console.log('  byteStringToInt available:', typeof byteStringToInt === 'function');
} catch (error) {
  console.log('✗ Functionality test failed:', error.message);
}

console.log('\n=== CJS Import Test Complete ===\n');
