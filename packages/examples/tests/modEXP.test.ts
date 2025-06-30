import { call, deploy, IExtPsbt } from '@opcat-labs/scrypt-ts-opcat';
import { ModExp } from '@opcat-labs/examples'
import { getDefaultProvider, getDefaultSigner } from './utils/helper'
import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `ModExp`', () => {
  let instance: ModExp;
  const signer = getDefaultSigner();
  const provider = getDefaultProvider();
  before(async () => {
    instance = new ModExp(13n);
  });

  it('should pass the public method successfully', async () => {

    const deployPsbt = await deploy(signer, provider, instance)

    expect(deployPsbt.extractTransaction().id).to.have.length(64)

    const callPsbt = await call(signer, provider, instance, (contract: ModExp, psbt: IExtPsbt) => {
      contract.main(2n, 3n, 8n);
    })

    expect(callPsbt.extractTransaction().id).to.have.length(64)
  });

  it('should fail with wrong x.', async () => {

    const deployPsbt = await deploy(signer, provider, instance)

    expect(deployPsbt.extractTransaction().id).to.have.length(64)
    await expect(call(signer, provider, instance, (contract: ModExp, psbt: IExtPsbt) => {
      contract.main(12n, 3n, 8n);
    })).to.be.rejectedWith('Execution failed');
  });

});
