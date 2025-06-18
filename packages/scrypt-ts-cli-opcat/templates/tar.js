// eslint-disable-next-line @typescript-eslint/no-require-imports
const tar = require('tar');

function compressDirectory(sourceDir, outPath) {
  tar
    .c(
      {
        gzip: true,
        file: outPath,
      },
      [sourceDir],
    )
    .then(() => console.log('Directory compressed successfully'));
}

compressDirectory('counter', '../assets/templates/counter.tar.gz');
compressDirectory('demo-contract', '../assets/templates/demo-contract.tar.gz');
compressDirectory('demo-lib', '../assets/templates/demo-lib.tar.gz');
