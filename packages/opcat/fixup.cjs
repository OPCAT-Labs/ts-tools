const glob = require('glob');
const fs = require('fs');
const util = require("util");
const globPromise = util.promisify(glob);
const updateRequires = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/.cjs/g, ".js");
  fs.writeFileSync(filePath, content, 'utf8');
};

async function main() {
  const files = await globPromise('./esm/**/*.js', { nodir: true });
  files.forEach((file) => {
    updateRequires(file);
  });
}

main();
