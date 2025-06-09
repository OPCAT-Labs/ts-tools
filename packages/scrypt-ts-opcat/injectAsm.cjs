const fs = require('fs');

async function main() {
  try {
    let indexerContent = JSON.parse(fs.readFileSync('scrypt.index.json', 'utf8'));
    indexerContent['bindings'].push({
      symbol: '__scrypt_ASM',
      path: 'asm.scrypt.tpl',
    });
    fs.writeFileSync('scrypt.index.json', JSON.stringify(indexerContent, null, 2), 'utf8');
  } catch (error) {
    console.error('Error injecting `__scrypt_ASM` into scrypt.index.json:', error);
  }
}

main();
