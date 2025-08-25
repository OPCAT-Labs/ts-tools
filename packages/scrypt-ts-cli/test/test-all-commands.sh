#!/bin/sh
set -e

if [ -n "$TRAVIS" ] || [ -n "$GITHUB_ACTIONS" ]; then
    echo "config git ..."
    git config  --global user.email "ci@scrypt.io"
    git config  --global user.name "scrypt"
else 
    echo "skip git config"
fi


installAndTest() {
    echo "installAndTest, using local npm registry"
    echo "registry=http://localhost:4873/" > .npmrc
    npm pkg set scripts.compile="npm_config_registry=http://localhost:4873/ npx -y @opcat-labs/cli-opcat compile"
    npm i --registry http://localhost:4873/
    npm run genprivkey
    npm t
}

# go to package root
cd ../..
rm -rf test-commands
mkdir -p test-commands

cd test-commands

echo "start local npm registry"
npm i -g verdaccio@6.1.2
globalNpmPath=$(npm root -g)
cp $globalNpmPath/verdaccio/conf/default.yaml ./config.yaml

verdaccio -c ./config.yaml & 
verdaccioPid=$!
sleep 5

/usr/bin/expect <<EOD
spawn npm adduser --registry http://localhost:4873/
expect {
  "Username:" {send "test\r"; exp_continue}
  "Password:" {send "testPass111\r"; exp_continue}
  "Email: (this IS public)" {send "test@test.com\r"; exp_continue}
}
EOD

/usr/bin/expect <<EOD
spawn npm login --registry http://localhost:4873/
expect {
  "Username:" {send "test\r"; exp_continue}
  "Password:" {send "testPass111\r"; exp_continue}
  "Email: (this IS public)" {send "test@test.com\r"; exp_continue}
}
EOD

cd ../packages/scrypt-ts/
cp ./package.json ../../test-commands/package.json.bak
npm pkg set version=999.999.999
npm publish --registry http://localhost:4873/
mv ../../test-commands/package.json.bak ./package.json

cd ../scrypt-ts-transpiler
cp ./package.json ../../test-commands/package.json.bak
npm pkg set version=999.999.999
npm pkg set dependencies.@opcat-labs/scrypt-ts=999.999.999
npm publish --registry http://localhost:4873/
mv ../../test-commands/package.json.bak ./package.json

cd ../scrypt-ts-cli
cp ./package.json ../../test-commands/package.json.bak
npm pkg set version=999.999.999
npm pkg set dependencies.@opcat-labs/scrypt-ts=999.999.999
npm pkg set dependencies.@opcat-labs/scrypt-ts-transpiler-opcat=999.999.999
npm publish --registry http://localhost:4873/
mv ../../test-commands/package.json.bak ./package.json

cd ../../test-commands

echo "testing get version info"
npm_config_registry=http://localhost:4873/ npx -y @opcat-labs/cli-opcat version

echo "testing get system info"
npm_config_registry=http://localhost:4873/ npx -y @opcat-labs/cli-opcat system


echo "testing create project hello-world"
rm -rf hello-world
npm_config_registry=http://localhost:4873/ npx -y @opcat-labs/cli-opcat project hello-world
cd hello-world
installAndTest
cd ..


echo "testing create project counter --state"
rm -rf counter
npm_config_registry=http://localhost:4873/ npx -y @opcat-labs/cli-opcat  project counter --state 
cd counter
installAndTest
cd ..


echo "testing create project my-lib --lib"
rm -rf my-lib
npm_config_registry=http://localhost:4873/ npx -y @opcat-labs/cli-opcat  project my-lib --lib
cd my-lib
installAndTest
cd ..

echo "testing create project hello-world-asm --asm"
rm -rf hello-world-asm
npm_config_registry=http://localhost:4873/ npx -y @opcat-labs/cli-opcat  project hello-world-asm --asm 
cd hello-world-asm
echo '{"HelloWorldAsm": {"unlock": "op_1 op_1 op_equalverify"}}' > .asm/asm.json
installAndTest
cd ..

ls -la

kill $verdaccioPid
cd ..
rm -rf test-commands
