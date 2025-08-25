import { StateLib, method, assert, ByteString, len, SHA256_HASH_LEN, FixedArray, toByteString, fill } from "@opcat-labs/scrypt-ts";
import { CAT20GuardConstState } from "./types";
import { ConstantsLib, STATE_HASH_BYTE_LEN, GUARD_TOKEN_TYPE_MAX, TX_INPUT_COUNT_MAX } from "../constants";


export class CAT20GuardStateLib extends StateLib<CAT20GuardConstState> {
    
  @method()
  static formalCheckState(_state: CAT20GuardConstState): ByteString {
    CAT20GuardStateLib.checkTokenScriptsUniq(_state.tokenScriptHashes)

    for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
      const scriptLen = len(_state.tokenScriptHashes[i])
      assert(scriptLen == SHA256_HASH_LEN)

      assert(_state.tokenAmounts[i] >= 0)
      assert(_state.tokenBurnAmounts[i] >= 0)
    }

    for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {

      const scriptIndex = _state.tokenScriptIndexes[i]
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

  
  static createEmptyState(): CAT20GuardConstState {
    const tokenScriptHashes = fill(toByteString(''), GUARD_TOKEN_TYPE_MAX)
    // default value to ensure the uniqueness of token scripts
    tokenScriptHashes[0] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF
    tokenScriptHashes[1] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE
    tokenScriptHashes[2] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD
    tokenScriptHashes[3] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC
    return {
      tokenScriptHashes: tokenScriptHashes,
      tokenAmounts: fill(0n, GUARD_TOKEN_TYPE_MAX),
      tokenBurnAmounts: fill(0n, GUARD_TOKEN_TYPE_MAX),
      tokenScriptIndexes: fill(-1n, TX_INPUT_COUNT_MAX),
    }
  }

}
