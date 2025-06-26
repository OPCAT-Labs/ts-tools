import { Transaction } from '@opcat-labs/opcat';
import * as fs from 'fs';
import { join } from 'path';
import { ContractLib } from '../src/common/contract';

const loadTxHex = (filename: string) => {
  const url = join(__dirname, filename);
  return fs.readFileSync(url).toString('utf8');
};

const getTx = (filename: string) => {
  return new Transaction(loadTxHex(filename));
};

describe('parsing token info from redeem script', () => {
  const genesisTx = getTx('genesisTx.hex');
  const deployTx = getTx('deployTx.hex');
  const mintTx = getTx('mintTx.hex');
  const guardTx = getTx('guardTx.hex');
  const transferTx = getTx('transferTx.hex');

  const decodeTxOutputs = function (tx: Transaction) {
    for (let index = 0; index < tx.outputs.length; index++) {
      const output = tx.outputs[index];
      expect([
        ContractLib.OPCAT_CAT20_TAG,
        ContractLib.OPCAT_MINTER_TAG,
        ContractLib.OPCAT_METADATA_TAG,
        ContractLib.OPCAT_UNKNOWN_TAG,
      ]).toContainEqual(ContractLib.decodeContractTag(output.data));
    }
  };

  it('should throw when parsing invalid script', () => {
    decodeTxOutputs(genesisTx);
    decodeTxOutputs(deployTx);
    decodeTxOutputs(mintTx);
    decodeTxOutputs(guardTx);
    decodeTxOutputs(transferTx);
  });
});
