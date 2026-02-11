const fs = require('fs');
const path = require('path');

async function main() {
  try {
    // 1. Inject __scrypt_ASM into scrypt.index.json
    let indexerContent = JSON.parse(fs.readFileSync('scrypt.index.json', 'utf8'));
    indexerContent['bindings'].push({
      symbol: '__scrypt_ASM',
      path: 'asm.scrypt.tpl',
    });

    // 2. Inject ChangeInfo into scrypt.index.json if not present
    const hasChangeInfo = indexerContent['bindings'].some(b => b.symbol === 'ChangeInfo');
    if (!hasChangeInfo) {
      indexerContent['bindings'].push({
        symbol: 'ChangeInfo',
        path: 'smart-contract/types/structs.scrypt.tpl',
      });
    }

    fs.writeFileSync('scrypt.index.json', JSON.stringify(indexerContent, null, 2), 'utf8');

    // 3. Inject ChangeInfo struct into structs.scrypt.tpl if not present
    const structsPath = path.join('assets', '.templates', 'smart-contract', 'types', 'structs.scrypt.tpl');
    let structsContent = fs.readFileSync(structsPath, 'utf8');

    if (!structsContent.includes('struct ChangeInfo')) {
      const changeInfoStruct = `
struct ChangeInfo {
  Ripemd160 pubkeyhash;
  int satoshis;
  Sha256 dataHash;
}`;
      structsContent = structsContent.trimEnd() + '\n' + changeInfoStruct + '\n';
      fs.writeFileSync(structsPath, structsContent, 'utf8');
    }
  } catch (error) {
    console.error('Error in injectAsm.cjs:', error);
  }
}

main();
