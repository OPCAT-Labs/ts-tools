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
    ContextUtils
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

/**
 * The CAT20 guard contract
 * @category Contract
 * @category CAT20
 * @onchain
 */
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
        // the number of curTx outputs except for the state hash root output
        outputCount: bigint
    ) {
        // check current input state hash empty

        CAT20GuardStateLib.formalCheckState(this.state);

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
                assert(this.state.tokenScriptHashes[i] != tokenScriptPlaceholders[i], 'token script hash is invalid, should not be placeholder')
                assert(
                    len(this.state.tokenScriptHashes[i]) == OUTPUT_LOCKING_SCRIPT_HASH_LEN, 'token script hash length is invalid'
                )
            } else {
                assert(this.state.tokenScriptHashes[i] == tokenScriptPlaceholders[i], 'token script hash is invalid, should be placeholder')
            }
        }
        assert(inputTokenTypes > 0n, 'input token types should be greater than 0')

        // inputTokenTypes here is not trustable yet
        // user could append token scripts in curState.tokenScripts that are not used in curTx inputs

        // sum token input amount, data comes from cat20 raw states passed in by the user
        const sumInputTokens = fill(0n, GUARD_TOKEN_TYPE_MAX)
        let tokenScriptIndexMax = -1n
        const inputCount = this.ctx.inputCount;
        for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
            const tokenScriptIndex = this.state.tokenScriptIndexes[Number(i)]
            if (i < inputCount) {
                assert(tokenScriptIndex < inputTokenTypes, 'token script index is invalid')
                if (tokenScriptIndex != -1n) {
                    // this is a token input
                    const tokenScriptHash =
                        this.state.tokenScriptHashes[Number(tokenScriptIndex)]
                    assert(tokenScriptHash == ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, BigInt(i)), 'token script hash is invalid')
                    CAT20StateLib.checkState(cat20States[i])
                    assert(ContextUtils.getSpentDataHash(this.ctx.spentDataHashes, BigInt(i)) == CAT20StateLib.stateHash(cat20States[i]), 'token state hash is invalid')
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
                assert(this.state.tokenScriptIndexes[i] == -1n, 'token script index is invalid')
            }
        }
        // verify inputTokenTypes by tokenScriptIndexMax
        // tokenScriptIndexMax is trustable because it is calculated after going through all the curTx inputs
        // this also ensures that there is at least one token input in curTx
        assert(
            tokenScriptIndexMax >= 0n && tokenScriptIndexMax == inputTokenTypes - 1n, 'token script index max is invalid'
        )

        // sum token output amount, data comes from outputTokens passed in by the user
        // and build curTx outputs and stateRoots as well
        assert(outputCount >= 0n && outputCount <= TX_OUTPUT_COUNT_MAX, 'output count is invalid')
        const sumOutputTokens = fill(0n, GUARD_TOKEN_TYPE_MAX)
        let outputs = toByteString('')
        for (let i = 0; i < TX_OUTPUT_COUNT_MAX; i++) {
            if (i < outputCount) {
                const ownerAddrOrScriptHash = ownerAddrOrScriptHashes[i]
                assert(len(ownerAddrOrScriptHash) > 0n, 'owner addr or script hash is invalid, should not be empty')
                const tokenScriptHashIndex = tokenScriptHashIndexes[i]
                assert(tokenScriptHashIndex < inputTokenTypes, 'token script hash index is invalid')
                if (tokenScriptHashIndex != -1n) {
                    // this is a token output
                    const tokenAmount = outputTokens[i]
                    assert(tokenAmount > 0n, 'token amount is invalid')
                    sumOutputTokens[Number(tokenScriptHashIndex)] = SafeMath.add(
                        sumOutputTokens[Number(tokenScriptHashIndex)],
                        tokenAmount
                    )
                    const tokenStateHash = CAT20StateLib.stateHash({
                        tag: ConstantsLib.OPCAT_CAT20_TAG,
                        ownerAddr: ownerAddrOrScriptHash,
                        amount: tokenAmount,
                    })
                    assert(nextStateHashes[i] == tokenStateHash, 'next state hash is invalid')
                    const tokenScriptHash =
                        this.state.tokenScriptHashes[Number(tokenScriptHashIndex)]
                    outputs += TxUtils.buildDataOutput(
                        tokenScriptHash,
                        outputSatoshis[i],
                        tokenStateHash
                    )
                } else {
                    // this is a non-token output
                    assert(outputTokens[i] == 0n, 'output tokens is invalid')
                    // locking script of this non-token output cannot be the same as any token script in curState
                    for (let j = 0; j < GUARD_TOKEN_TYPE_MAX; j++) {
                        assert(ownerAddrOrScriptHash != this.state.tokenScriptHashes[j], 'owner addr or script hash is invalid')
                    }
                    outputs += TxUtils.buildDataOutput(
                        ownerAddrOrScriptHash,
                        outputSatoshis[i],
                        nextStateHashes[i]
                    )
                }
            } else {
                assert(len(ownerAddrOrScriptHashes[i]) == 0n, 'owner addr or script hash is invalid, should be 0')
                assert(tokenScriptHashIndexes[i] == -1n, 'token script hash index is invalid, should be -1')
                assert(outputTokens[i] == 0n, 'output tokens is invalid, should be 0')
                assert(nextStateHashes[i] == toByteString(''), 'next state hash is invalid, should be empty')
                assert(outputSatoshis[i] == 0n, 'output satoshis is invalid, should be 0')
            }
        }

        // check token amount consistency of inputs and outputs
        for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
            assert(sumInputTokens[i] == this.state.tokenAmounts[i], 'sum input tokens is invalid, should be equal to token amount')
            assert(
                sumInputTokens[i] ==
                SafeMath.add(sumOutputTokens[i], this.state.tokenBurnAmounts[i]),
                'sum input tokens is invalid, should be equal to sum output tokens plus sum burn tokens'
            );
            if (i < Number(inputTokenTypes)) {
                assert(sumInputTokens[i] > 0n, 'sum input tokens is invalid, should be greater than 0')
            } else {
                assert(sumInputTokens[i] == 0n, 'sum input tokens is invalid, should be 0')
                assert(sumOutputTokens[i] == 0n, 'sum output tokens is invalid, should be 0')
                // no need to check below two lines here, but we keep them here for better readability
                assert(this.state.tokenAmounts[i] == 0n, 'token amount is invalid, should be 0')
                assert(this.state.tokenBurnAmounts[i] == 0n, 'token burn amount is invalid, should be 0')
            }
        }

        // confine curTx outputs
        assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
    }
}
