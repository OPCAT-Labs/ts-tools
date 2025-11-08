import { StateLib, method, assert, ByteString, len, SHA256_HASH_LEN, FixedArray, toByteString, fill, byteStringToInt, slice, intToByteString } from "@opcat-labs/scrypt-ts-opcat";
import { CAT20GuardConstState } from "./types";
import { ConstantsLib, GUARD_TOKEN_TYPE_MAX, TX_INPUT_COUNT_MAX, TX_INPUT_COUNT_MAX_6, TX_INPUT_COUNT_MAX_12 } from "../constants";

/**
 * The CAT20 guard state library
 * @category Contract
 * @category CAT20
 * @onchain
 */
export class CAT20GuardStateLib extends StateLib<CAT20GuardConstState> {

  @method()
  static formalCheckState6(_state: CAT20GuardConstState): ByteString {
    CAT20GuardStateLib.checkTokenScriptsUniq(_state.tokenScriptHashes)

    for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
      const scriptLen = len(_state.tokenScriptHashes[i])
      assert(scriptLen == SHA256_HASH_LEN)

      assert(_state.tokenAmounts[i] >= 0)
      assert(_state.tokenBurnAmounts[i] >= 0)
    }

    assert(len(_state.tokenScriptIndexes) == BigInt(TX_INPUT_COUNT_MAX_6))
    for (let i = 0; i < TX_INPUT_COUNT_MAX_6; i++) {
      const scriptIndex = byteStringToInt(slice(_state.tokenScriptIndexes, BigInt(i), BigInt(i + 1)))
      assert(scriptIndex >= -1 && scriptIndex < GUARD_TOKEN_TYPE_MAX)
    }
    // return CAT20GuardProto.stateHash(_state)
    return toByteString('')
  }

  @method()
  static formalCheckState12(_state: CAT20GuardConstState): ByteString {
    CAT20GuardStateLib.checkTokenScriptsUniq(_state.tokenScriptHashes)

    for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
      const scriptLen = len(_state.tokenScriptHashes[i])
      assert(scriptLen == SHA256_HASH_LEN)

      assert(_state.tokenAmounts[i] >= 0)
      assert(_state.tokenBurnAmounts[i] >= 0)
    }

    assert(len(_state.tokenScriptIndexes) == BigInt(TX_INPUT_COUNT_MAX_12))
    for (let i = 0; i < TX_INPUT_COUNT_MAX_12; i++) {
      const scriptIndex = byteStringToInt(slice(_state.tokenScriptIndexes, BigInt(i), BigInt(i + 1)))
      assert(scriptIndex >= -1 && scriptIndex < GUARD_TOKEN_TYPE_MAX)
    }
    // return CAT20GuardProto.stateHash(_state)
    return toByteString('')
  }


  /**
   * Ensure tokenScripts does not have duplicate values
   * @param tokenScripts token scripts
   */
  @method()
  static checkTokenScriptsUniq(
    tokenScripts: FixedArray<ByteString, typeof GUARD_TOKEN_TYPE_MAX>
  ): void {
    // c42
    assert(tokenScripts[0] != tokenScripts[1])
    assert(tokenScripts[0] != tokenScripts[2])
    assert(tokenScripts[0] != tokenScripts[3])
    assert(tokenScripts[1] != tokenScripts[2])
    assert(tokenScripts[1] != tokenScripts[3])
    assert(tokenScripts[2] != tokenScripts[3])
  }


  static createEmptyState(txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12): CAT20GuardConstState {
    const tokenScriptHashes = fill(toByteString(''), GUARD_TOKEN_TYPE_MAX)
    // default value to ensure the uniqueness of token scripts
    tokenScriptHashes[0] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF
    tokenScriptHashes[1] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE
    tokenScriptHashes[2] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD
    tokenScriptHashes[3] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC

    let tokenScriptIndexesArray = fill(-1n, txInputCountMax)
    const tokenScriptIndexes = tokenScriptIndexesArray.map(index => intToByteString(index, 1n)).join('')

    return {
      tokenScriptHashes: tokenScriptHashes,
      tokenAmounts: fill(0n, GUARD_TOKEN_TYPE_MAX),
      tokenBurnAmounts: fill(0n, GUARD_TOKEN_TYPE_MAX),
      tokenScriptIndexes,
    }
  }
}
