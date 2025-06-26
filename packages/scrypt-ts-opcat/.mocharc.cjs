const offchainSpec = ['./test/local-test/*.test.ts' /*, './test/nonTxn-test/*.test.ts'*/];
const onchainSpec = './test/onchain-test/*.test.ts';

const isOnchain = process.env.NETWORK !== undefined;

const config = {
  $schema: 'https://json.schemastore.org/mocharc.json',
  require: ['tsx'],
  extension: ['ts'],
  spec: isOnchain ? onchainSpec : offchainSpec,
  // "exclude": ["./test/local-test/stateDelete.test.ts"],
  package: './package.json',
  recursive: true,
  timeout: 60000,
};

module.exports = config;
