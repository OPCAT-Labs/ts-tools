import { Transaction } from '@opcat-labs/opcat';
import { ChainProvider, UtxoProvider } from '../providers/index.js';
import { markSpent } from '../providers/utxoProvider.js';
import { ExtPsbt } from '../psbt/extPsbt.js';
import { ContractCall } from '../psbt/types.js';
import { Signer } from '../signer.js';
import { SmartContract } from '../smart-contract/smartContract.js';
import { OpcatState } from '../smart-contract/types/primitives.js';
import { InputIndex } from '../globalTypes.js';


/**
 * Options for calling a smart contract method.
 * @property contract - The smart contract instance to call.
 * @property satoshis - Amount of satoshis to send with the call.
 * @property lockTime - Lock time for the transaction.
 * @property sequence - Sequence number for the transaction.
 * @property changeAddress - Address to receive change.
 * @property feeRate - Fee rate in satoshis per byte.
 * @property withBackTraceInfo - Whether to include backtrace info.
 * @property unfinalize - Whether to keep transaction unfinalized.
 * @property prevPrevTxFinder - Function to find previous transaction for an input.
 */
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
 * Calls a smart contract method and broadcasts the transaction.
 * 
 * @param signer - The signer to sign the transaction
 * @param provider - The provider to interact with the blockchain
 * @param contract - The smart contract instance to call
 * @param contractCall - The contract method call details
 * @param options - Optional call configuration (fee rate, change address, etc.)
 * @returns A promise resolving to the signed PSBT (Partially Signed Bitcoin Transaction)
 * 
 * @remarks
 * - Automatically handles UTXO selection and change calculation
 * - Supports contract outputs if specified in options
 * - Can include backtrace information if enabled
 * - Broadcasts the transaction by default (can be disabled with unfinalize option)
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
    .addContractInput(contract, contractCall)
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
