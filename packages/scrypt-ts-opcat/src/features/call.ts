import { Transaction } from '@opcat-labs/opcat';
import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { ContractCall } from '../psbt/types.js';
import { Signer } from '../signer.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { OpcatState } from '../smart-contract/types/primitives.js';
import { InputIndex } from '../globalTypes.js';

export type CallOptions = {
  contract?: SmartContract<OpcatState>; 
  satoshis?: number, 
  lockTime?: number,
  sequence?: number, 
  changeAddress?: string, 
  feeRate?: number,
  withBackTraceInfo?: boolean,
  unfinalize?: boolean,
  prevPrevTxFinder?: (prevTx: Transaction, provider: UtxoProvider & ChainProvider, inputIndex: InputIndex) => Promise<string>
}
/**
 * call a contract
 * @category Feature
 * @param signer a signer, such as {@link DefaultSigner}  or {@link UnisatSigner}
 * @param provider a {@link UtxoProvider} & {@link ChainProvider}
 * @param contract the contract
 * @param contractCall the contract call function, such as `(contract: Counter) => { contract.increase() }`
 * @param options the new contract, such as `{ contract: newContract, satoshis: 1 }`
 * @returns the called psbt
 */
export async function call<Contract extends SmartContract<OpcatState>>(
  signer: Signer,
  provider: UtxoProvider & ChainProvider,
  contract: Contract,
  contractCall: ContractCall<Contract>,
  options?: CallOptions,
): Promise<ExtPsbt> {
  const address = await signer.getAddress();

  const feeRate = options?.feeRate || await provider.getFeeRate();

  const utxos = await provider.getUtxos(address);

  const network = await provider.getNetwork();

  const psbt = new ExtPsbt({ network: network })
    .addContractInput(contract)
    .spendUTXO(utxos.slice(0, 10));

  if (options && options.contract) {
    const satoshis = options?.satoshis || 1;
    psbt.addContractOutput(options.contract, satoshis);
  }

  const changeAddress = options?.changeAddress || address;
  psbt.change(changeAddress, feeRate);

  const lockTime = options?.lockTime || 0;
  const sequence = options?.sequence || 0xffffffff;
  psbt.setLocktime(lockTime)
  psbt.setInputSequence(0, sequence);


  if (options?.withBackTraceInfo) {
    await psbt.calculateBacktraceInfo(provider, options.prevPrevTxFinder);
  }
  psbt.updateContractInput(0, contractCall);
  psbt.seal();

  const signedPsbtHex = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions());

  const signedPsbt = psbt.combine(ExtPsbt.fromHex(signedPsbtHex));
  if(options?.unfinalize) {
    return signedPsbt;
  }
  
  signedPsbt.finalizeAllInputs();
  const callTx = signedPsbt.extractTransaction();
  await provider.broadcast(callTx.toHex());
  markSpent(provider, callTx);
  return signedPsbt;
}
