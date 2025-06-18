const glob = require("glob");
const fs = require("fs");
const { basename, dirname, join } = require("path");
const { cwd } = require("process");

const updateRequires = (filePath) => {
  let content = fs.readFileSync(filePath, "utf8");
  //replace local imports eg. require("./ecpair.js") to require("ecpair.cjs")
  content = content.replace(
    /require\("\.\/([^"]*)\.js"\)/g,
    "require('./$1.cjs')",
  );
  content = content.replace(
    /require\("\.\.\/([^"]*)\.js"\)/g,
    "require('../$1.cjs')",
  );

  fs.writeFileSync(filePath, content, "utf8");
};

async function main() {
  const files = await glob.glob("dist/cjs/**/*.js", { nodir: true });
  files.forEach((file) => {
    updateRequires(file);
    const fileName = basename(file);
    const dir = dirname(file);
    fs.renameSync(file, join(dir, fileName.replace(".js", ".cjs")));
  });

  const esmPath = join(cwd(), "dist", "esm", "index.js");

  const esmArifact = fs.readFileSync(esmPath).toString();

  fs.writeFileSync(
    esmPath,
    esmArifact
      .split("\n")
      .map((line) => line.replace("../artifacts", "../../artifacts"))
      .join("\n"),
  );

  const cjsPath = join(cwd(), "dist", "cjs", "index.cjs");
  const cjsArifact = fs.readFileSync(cjsPath).toString();
  fs.writeFileSync(
    cjsPath,
    cjsArifact
      .split("\n")
      .map((line) => line.replace("../artifacts", "../../artifacts"))
      .join("\n"),
  );
}

main();
