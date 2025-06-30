import { call, deploy, IExtPsbt } from '@opcat-labs/scrypt-ts-opcat';
import { Matrix } from '@opcat-labs/examples'
import { getDefaultProvider, getDefaultSigner } from './utils/helper'
import { expect } from 'chai'

describe('Test SmartContract `Matrix`', () => {
  let instance: Matrix;
  const signer = getDefaultSigner();
  const provider = getDefaultProvider();
  before(async () => {
    instance = new Matrix();
  });

  it('should pass the public method successfully', async () => {

    const deployPsbt = await deploy(signer, provider, instance)

    expect(deployPsbt.extractTransaction().id).to.have.length(64)

    const callPsbt = await call(signer, provider, instance, (contract: Matrix, psbt: IExtPsbt) => {
      contract.main([
        [10n, 10n, 10n, 10n],
        [20n, 20n, 20n, 20n],
        [30n, 30n, 30n, 30n],
        [40n, 40n, 40n, 40n],
      ]);
    })

    expect(callPsbt.extractTransaction().id).to.have.length(64)
  });
});
