import { StateLib, method, assert, ByteString, len, SHA256_HASH_LEN, FixedArray, toByteString, fill, byteStringToInt, slice, intToByteString } from "@opcat-labs/scrypt-ts-opcat";
import { CAT20GuardConstState } from "./types.js";
import { ConstantsLib, GUARD_TOKEN_TYPE_MAX, INVALID_INDEX, TX_INPUT_COUNT_MAX_6, TX_INPUT_COUNT_MAX_12 } from "../constants.js";

/**
 * The CAT20 guard state library
 * @category Contract
 * @category CAT20
 * @onchain
 */
export class CAT20GuardStateLib extends StateLib<CAT20GuardConstState> {

  @method()
  static formalCheckState(_state: CAT20GuardConstState, txInputCountMax: number): void {
    CAT20GuardStateLib.checkTokenScriptsUniq(_state.tokenScriptHashes)

    for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
      const scriptLen = len(_state.tokenScriptHashes[i])
      assert(scriptLen == SHA256_HASH_LEN)
    }

    assert(len(_state.tokenScriptIndexes) == BigInt(txInputCountMax))
    for (let i = 0; i < txInputCountMax; i++) {
      const scriptIndex = byteStringToInt(slice(_state.tokenScriptIndexes, BigInt(i), BigInt(i + 1)))
      assert(scriptIndex >= Number(INVALID_INDEX) && scriptIndex < GUARD_TOKEN_TYPE_MAX)
    }
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


  /**
   * Creates an empty CAT20 guard state with default values
   * @param txInputCountMax Maximum number of transaction inputs supported by this guard variant
   * @returns Empty guard state with placeholder token script hashes and -1 indexes for all inputs
   * @note F21 Fix: Uses intToByteString(index, 1) to encode -1 as 0x81 for consistency with on-chain validation
   */
  static createEmptyState(txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12): CAT20GuardConstState {
    const tokenScriptHashes = fill(toByteString(''), GUARD_TOKEN_TYPE_MAX)
    // default value to ensure the uniqueness of token scripts
    tokenScriptHashes[0] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF
    tokenScriptHashes[1] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE
    tokenScriptHashes[2] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD
    tokenScriptHashes[3] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC

    const tokenScriptIndexesArray = fill(INVALID_INDEX, txInputCountMax)
    const tokenScriptIndexes = tokenScriptIndexesArray.map(index => intToByteString(index, 1n)).join('')

    return {
      deployerAddr: toByteString(''),
      tokenScriptHashes: tokenScriptHashes,
      tokenScriptIndexes,
    }
  }
}
