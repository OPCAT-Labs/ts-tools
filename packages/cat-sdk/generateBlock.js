/* eslint-disable */
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

// // when the mempool size is greater than MEMPOOL_SIZE, do a generating
// const MEMPOOL_SIZE = 2;
// // the path of the bitcoin-cli
// const BITCOIN_CLI = '/root/opcatchain/src/bitcoin-cli';
// // the type of the node, BTC or OPCAT
// const NODE_TYPE = 'OPCAT';  // BTC or OPCAT
// // the number of blocks to generate for each generating
// const GENERATE_BLOCK_COUNT = 2;
// // the interval of the generating, milliseconds
// const GENERATE_INTERVAL = 1e3;

// when the mempool size is greater than MEMPOOL_SIZE, do a generating
const MEMPOOL_SIZE = 2;
// the path of the bitcoin-cli
const BITCOIN_CLI =
  "/root/bitcoin-inq-regtest/bitcoin-28.0-inq/bin/bitcoin-cli -conf=/root/bitcoin-inq-regtest/bitcoin/bitcoin.conf -datadir=/root/bitcoin-inq-regtest/bitcoin";
// the type of the node, BTC or OPCAT
const NODE_TYPE = "BTC"; // BTC or OPCAT
// the number of blocks to generate for each generating
const GENERATE_BLOCK_COUNT = 2;
// the interval of the generating, milliseconds
const GENERATE_INTERVAL = 1e3;

const task = async () => {
  // 1. get mempool info by run `bitcoin-cli getmempoolinfo`
  const mempoolInfoStr = (
    await execAsync(`${BITCOIN_CLI} getmempoolinfo`)
  ).stdout.toString();
  // get the stdout of the command
  const mempoolInfo = JSON.parse(mempoolInfoStr);
  const txCount = mempoolInfo.size;
  if (txCount >= MEMPOOL_SIZE) {
    console.log(new Date(), `txCount: ${txCount}`);
    // 2. generate a block
    if (NODE_TYPE === "BTC") {
      // BTC
      const generateResult = (
        await execAsync(`${BITCOIN_CLI} -generate ${GENERATE_BLOCK_COUNT}`)
      ).stdout.toString();
      console.log(new Date(), `generate a block result: ${generateResult}`);
    } else {
      // OPCAT
      const generateResult = (
        await execAsync(`${BITCOIN_CLI} generate ${GENERATE_BLOCK_COUNT}`)
      ).stdout.toString();
      console.log(new Date(), `generate a block result: ${generateResult}`);
    }
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  while (true) {
    try {
      await task();
      await sleep(GENERATE_INTERVAL);
    } catch (error) {
      console.error(error);
    }
  }
};

main();
