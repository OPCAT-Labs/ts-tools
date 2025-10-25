import {
  ByteString,
  FixedArray,
  SmartContract,
  assert,
  fill,
  hash256,
  len,
  method,
  toByteString,
  TxUtils,
  ContextUtils,
} from '@opcat-labs/scrypt-ts-opcat'
import {
  TX_INPUT_COUNT_MAX,
  GUARD_TOKEN_TYPE_MAX,
  OUTPUT_LOCKING_SCRIPT_HASH_LEN,
  STATE_HASH_BYTE_LEN,
  ConstantsLib,
  TX_OUTPUT_COUNT_MAX,
} from '../constants'
import { CAT20State, CAT20GuardConstState, CAT20_AMOUNT } from './types'
import { SafeMath } from '../utils/safeMath'
import { CAT20GuardStateLib } from './cat20GuardStateLib'
import { StateHashes } from '../types'
import { CAT20StateLib } from './cat20StateLib'

export class CAT20Guard extends SmartContract<CAT20GuardConstState> {
  @method()
  public unlock(
    nextStateHashes: StateHashes,
    // for each curTx output except the state hash root output,
    // if it is a token output, the value is token owner address of this output,
    // otherwise, the value is the locking script hash of this output
    ownerAddrOrScriptHashes: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>,
    // for each curTx output except the state hash root output,
    // if it is a token output, the value is the token amount of this output,
    // otherwise, the value is 0 by default
    outputTokens: FixedArray<CAT20_AMOUNT, typeof TX_OUTPUT_COUNT_MAX>,
    // for each curTx output except the state hash root output,
    // if it is a token output,
    // the value marks the index of the token script used by this output in the tokenScripts,
    // otherwise, the value is -1 by default
    // this logic is the same as tokenScriptIndexes in GuardConstState which is used for token inputs
    tokenScriptHashIndexes: FixedArray<
      CAT20_AMOUNT,
      typeof TX_OUTPUT_COUNT_MAX
    >,
    // output satoshi of each curTx output except the state hash root output
    outputSatoshis: FixedArray<bigint, typeof TX_OUTPUT_COUNT_MAX>,
    // for each curTx input,
    // if it is a token input, the value is the raw state of this input,
    // otherwise, the value is an empty state by default
    cat20States: FixedArray<CAT20State, typeof TX_INPUT_COUNT_MAX>,
    // for each input of curTx
    // if the input is a token, the value marks the index of the token script in the tokenScriptHashes array
    // otherwise, the value is -1 by default
    // e.g.
    // [-1, 0, 1, 1, 0, -1]
    // this means
    // the input #0 and #5 is not a token contract
    // the input #1 and #4 is a token contract with script tokenScripts[0] = 'token1Script'
    // the input #2 and #3 is a token contract with script tokenScripts[1] = 'token2Script'
    tokenScriptIndexes: FixedArray<bigint, typeof TX_INPUT_COUNT_MAX>,
    // the number of curTx outputs except for the state hash root output
    outputCount: bigint
  ) {
    // check current input state hash empty

    CAT20GuardStateLib.formalCheckState(this.state)

    // how many different types of tokens in curTx inputs
    let inputTokenTypes = 0n
    const tokenScriptPlaceholders: FixedArray<
      ByteString,
      typeof GUARD_TOKEN_TYPE_MAX
    > = [
      ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF,
      ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE,
      ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD,
      ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC,
    ]
    for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
      if (this.state.tokenScriptHashes[i] != tokenScriptPlaceholders[i]) {
        inputTokenTypes++
      }
    }
    // ensure there are no placeholders between valid token scripts in curState.tokenScriptHashes
    for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
      if (i < Number(inputTokenTypes)) {
        assert(this.state.tokenScriptHashes[i] != tokenScriptPlaceholders[i])
        assert(
          len(this.state.tokenScriptHashes[i]) == OUTPUT_LOCKING_SCRIPT_HASH_LEN
        )
      } else {
        assert(this.state.tokenScriptHashes[i] == tokenScriptPlaceholders[i])
      }
    }
    assert(inputTokenTypes > 0n)

    // inputTokenTypes here is not trustable yet
    // user could append token scripts in curState.tokenScripts that are not used in curTx inputs

    // sum token input amount, data comes from cat20 raw states passed in by the user
    const sumInputTokens = fill(0n, GUARD_TOKEN_TYPE_MAX)
    let tokenScriptIndexMax = -1n
    const inputCount = this.ctx.inputCount
    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
      const tokenScriptIndex = tokenScriptIndexes[Number(i)]
      if (i < inputCount) {
        assert(tokenScriptIndex < inputTokenTypes)
        if (tokenScriptIndex != -1n) {
          // this is a token input
          const tokenScriptHash =
            this.state.tokenScriptHashes[Number(tokenScriptIndex)]
          assert(
            tokenScriptHash ==
              ContextUtils.getSpentScriptHash(
                this.ctx.spentScriptHashes,
                BigInt(i)
              )
          )
          CAT20StateLib.checkState(cat20States[i])
          assert(
            ContextUtils.getSpentDataHash(
              this.ctx.spentDataHashes,
              BigInt(i)
            ) == CAT20StateLib.stateHash(cat20States[i])
          )
          sumInputTokens[Number(tokenScriptIndex)] = SafeMath.add(
            sumInputTokens[Number(tokenScriptIndex)],
            cat20States[i].amount
          )
          tokenScriptIndexMax =
            tokenScriptIndex > tokenScriptIndexMax
              ? tokenScriptIndex
              : tokenScriptIndexMax
        }
      } else {
        assert(tokenScriptIndexes[i] == -1n)
      }
    }
    // verify inputTokenTypes by tokenScriptIndexMax
    // tokenScriptIndexMax is trustable because it is calculated after going through all the curTx inputs
    // this also ensures that there is at least one token input in curTx
    assert(
      tokenScriptIndexMax >= 0n && tokenScriptIndexMax == inputTokenTypes - 1n
    )

    // sum token output amount, data comes from outputTokens passed in by the user
    // and build curTx outputs and stateRoots as well
    assert(outputCount >= 0n && outputCount <= TX_OUTPUT_COUNT_MAX)
    const sumOutputTokens = fill(0n, GUARD_TOKEN_TYPE_MAX)
    let outputs = toByteString('')
    for (let i = 0; i < TX_OUTPUT_COUNT_MAX; i++) {
      if (i < outputCount) {
        const ownerAddrOrScriptHash = ownerAddrOrScriptHashes[i]
        assert(len(ownerAddrOrScriptHash) > 0n)
        const tokenScriptHashIndex = tokenScriptHashIndexes[i]
        assert(tokenScriptHashIndex < inputTokenTypes)
        if (tokenScriptHashIndex != -1n) {
          // this is a token output
          const tokenAmount = outputTokens[i]
          assert(tokenAmount > 0n)
          sumOutputTokens[Number(tokenScriptHashIndex)] = SafeMath.add(
            sumOutputTokens[Number(tokenScriptHashIndex)],
            tokenAmount
          )
          const tokenStateHash = CAT20StateLib.stateHash({
            tag: ConstantsLib.OPCAT_CAT20_TAG,
            ownerAddr: ownerAddrOrScriptHash,
            amount: tokenAmount,
          })
          assert(nextStateHashes[i] == tokenStateHash)
          const tokenScriptHash =
            this.state.tokenScriptHashes[Number(tokenScriptHashIndex)]
          outputs += TxUtils.buildDataOutput(
            tokenScriptHash,
            outputSatoshis[i],
            tokenStateHash
          )
        } else {
          // this is a non-token output
          assert(outputTokens[i] == 0n)
          // locking script of this non-token output cannot be the same as any token script in curState
          for (let j = 0; j < GUARD_TOKEN_TYPE_MAX; j++) {
            assert(ownerAddrOrScriptHash != this.state.tokenScriptHashes[j])
          }
          outputs += TxUtils.buildDataOutput(
            ownerAddrOrScriptHash,
            outputSatoshis[i],
            nextStateHashes[i]
          )
        }
      } else {
        assert(len(ownerAddrOrScriptHashes[i]) == 0n)
        assert(tokenScriptHashIndexes[i] == -1n)
        assert(outputTokens[i] == 0n)
        assert(nextStateHashes[i] == toByteString(''))
        assert(outputSatoshis[i] == 0n)
      }
    }

    // check token amount consistency of inputs and outputs
    for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
      assert(sumInputTokens[i] == this.state.tokenAmounts[i])
      assert(
        sumInputTokens[i] ==
          SafeMath.add(sumOutputTokens[i], this.state.tokenBurnAmounts[i])
      )
      if (i < Number(inputTokenTypes)) {
        assert(sumInputTokens[i] > 0n)
      } else {
        assert(sumInputTokens[i] == 0n)
        assert(sumOutputTokens[i] == 0n)
        // no need to check below two lines here, but we keep them here for better readability
        assert(this.state.tokenAmounts[i] == 0n)
        assert(this.state.tokenBurnAmounts[i] == 0n)
      }
    }

    // confine curTx outputs
    assert(this.checkOutputs(outputs))
  }
}
