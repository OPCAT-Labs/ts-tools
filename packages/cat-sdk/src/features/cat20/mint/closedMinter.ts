
import { addChangeUtxoToProvider, ByteString, PubKey, toHex } from '@opcat-labs/scrypt-ts-opcat'
import { ExtPsbt, Signer, ChainProvider, UtxoProvider, UTXO, getBackTraceInfo, markSpent } from '@opcat-labs/scrypt-ts-opcat'
import { CAT20_AMOUNT } from '../../../contracts/cat20/types.js'
import { CAT20ClosedMinterState, CAT20State } from '../../../contracts/cat20/types.js'
import { ContractPeripheral, CAT20GuardPeripheral } from '../../../utils/contractPeripheral.js'
import { CAT20 } from '../../../contracts/cat20/cat20.js'
import { checkArgument } from '../../../utils/check.js'
import { CAT20ClosedMinter } from '../../../contracts/cat20/minters/cat20ClosedMinter.js'
import { outpoint2ByteString, toTokenOwnerAddress, normalizeUtxoScripts } from '../../../utils/index.js'
import { Postage } from '../../../typeConstants.js'
import { Transaction } from '@opcat-labs/opcat'
import { ConstantsLib } from '../../../contracts/index.js'


/**
 * Mints a CAT20 token using `CAT20ClosedMinter` contract
 * Only the token issuer can mint token
 * @category Feature
 * @param signer the signer for the issuer
 * @param provider the provider for the blockchain and UTXO operations
 * @param minterUtxo the UTXO of the minter contract
 * @param hasAdmin whether the token has admin
 * @param adminScriptHash the admin script hash
 * @param tokenId the ID of the token
 * @param tokenReceiver the address to receive the token
 * @param tokenAmount the amount of the token to mint
 * @param changeAddress the address for the change output
 * @param feeRate the fee rate for the transaction
 * @returns the mint Psbt and the UTXO of the minted token
 */
export async function mintClosedMinterToken(
  signer: Signer,
  provider: ChainProvider & UtxoProvider,
  minterUtxo: UTXO,
  hasAdmin: boolean,
  adminScriptHash: string,
  tokenId: string,
  tokenReceiver: ByteString,
  tokenAmount: CAT20_AMOUNT,
  changeAddress: string,
  feeRate: number
): Promise<{
  mintPsbt: ExtPsbt
  cat20Utxo: UTXO
  mintTxId: string
}> {
  const address = await signer.getAddress()
  const pubkey = await signer.getPublicKey()

  // fetch minter preTx
  const minterInputIndex = 0
  const spentMinterTxHex = await provider.getRawTransaction(minterUtxo.txId)
  const spentMinterTx = new Transaction(spentMinterTxHex)
  const minterPreTxHex = await provider.getRawTransaction(
    toHex(spentMinterTx.inputs[minterInputIndex].prevTxId)
  )

  const closedMinter = new CAT20ClosedMinter(
    toTokenOwnerAddress(changeAddress),
    outpoint2ByteString(tokenId)
  )
  const minterScript = closedMinter.lockingScript.toHex()
  minterUtxo = normalizeUtxoScripts([minterUtxo], minterScript)[0]
  const minterScriptHash = ContractPeripheral.scriptHash(minterUtxo.script)
  const cat20 = new CAT20(
    minterScriptHash,
    CAT20GuardPeripheral.getGuardVariantScriptHashes(),
    hasAdmin,
    adminScriptHash
  )
  const cat20ScriptHash = ContractPeripheral.scriptHash(cat20)

  const minterState: CAT20ClosedMinterState =
    CAT20ClosedMinter.deserializeState(minterUtxo.data)
  checkArgument(
    minterState.tokenScriptHash === cat20ScriptHash,
    `tokenScriptHash in minterUtxo.data is not match, expected: ${cat20ScriptHash}, actual: ${minterState.tokenScriptHash}`
  )

  checkArgument(
    ContractPeripheral.scriptHash(closedMinter) === minterScriptHash,
    `minterScriptHash in minterUtxo.data is not match, expected: ${minterScriptHash}, actual: ${ContractPeripheral.scriptHash(
      closedMinter
    )}`
  )

  const cat20State: CAT20State = {
    ownerAddr: tokenReceiver,
    amount: tokenAmount,
  }
  cat20.state = cat20State

  const backtraceInfo = getBackTraceInfo(
    spentMinterTxHex,
    minterPreTxHex,
    minterInputIndex
  )
  const utxos = await provider.getUtxos(address)

  closedMinter.bindToUtxo(minterUtxo)
  closedMinter.state = minterState

  const nextMinter = closedMinter.next(closedMinter.state)
  const mintTx = new ExtPsbt({ network: await provider.getNetwork() })
    .addContractInput(closedMinter, (contract, tx) => {
      const sig = tx.getSig(minterInputIndex, {
        address: changeAddress,
      })
      contract.mint(
        cat20State,

        PubKey(pubkey),
        sig,

        BigInt(Postage.MINTER_POSTAGE),
        BigInt(Postage.TOKEN_POSTAGE),
        backtraceInfo
      )
    }
    )
    .spendUTXO(utxos)
    .addContractOutput(nextMinter, Postage.MINTER_POSTAGE)
    .addContractOutput(cat20, Postage.TOKEN_POSTAGE)
    .change(changeAddress, feeRate)
    .seal()

  const signedMintTx = await signer.signPsbt(
    mintTx.toHex(),
    mintTx.psbtOptions()
  )
  mintTx.combine(ExtPsbt.fromHex(signedMintTx))
  mintTx.finalizeAllInputs()

  await provider.broadcast(mintTx.extractTransaction().toHex())
  markSpent(provider, mintTx.extractTransaction())
  addChangeUtxoToProvider(provider, mintTx)

  return {
    mintPsbt: mintTx,
    cat20Utxo: mintTx.getUtxo(1),
    mintTxId: mintTx.extractTransaction().id,
  }
}
