import { assert, ByteString, byteStringToInt, fill, FixedArray, intToByteString, len, method, Ripemd160, sha1, SHA256_HASH_LEN, slice, StateLib, toByteString } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721GuardConstState } from "./types.js";
import { ConstantsLib, NFT_GUARD_COLLECTION_TYPE_MAX, TX_INPUT_COUNT_MAX_12, TX_INPUT_COUNT_MAX_6 } from "../constants.js";


/**
 * The CAT721 guard state library
 * @category Contract
 * @category CAT721
 * @onchain
 */
export class CAT721GuardStateLib extends StateLib<CAT721GuardConstState> {
    @method()
    static formalCheckState(_state: CAT721GuardConstState, txInputCountMax: number): void {
        CAT721GuardStateLib.checkNftScriptsUniq(_state.nftScriptHashes)

        for (let i = 0; i < NFT_GUARD_COLLECTION_TYPE_MAX; i++) {
            const scriptLen = len(_state.nftScriptHashes[i]);
            assert(scriptLen == SHA256_HASH_LEN);
        }

        assert(len(_state.nftScriptIndexes) == BigInt(txInputCountMax))
        // F18 Fix: Check nftBurnMasks length
        assert(len(_state.nftBurnMasks) == BigInt(txInputCountMax), 'nftBurnMasks length is invalid')
        for (let i = 0; i < txInputCountMax; i++) {
            const scriptIndex = byteStringToInt(slice(_state.nftScriptIndexes, BigInt(i), BigInt(i + 1)));
            assert(scriptIndex >= -1 && scriptIndex < NFT_GUARD_COLLECTION_TYPE_MAX);
        }
    }

    @method()
    static checkNftScriptsUniq(nftScripts: FixedArray<ByteString, typeof NFT_GUARD_COLLECTION_TYPE_MAX>): void {
        // c42
        assert(nftScripts[0] != nftScripts[1]);
        assert(nftScripts[0] != nftScripts[2]);
        assert(nftScripts[0] != nftScripts[3]);
        assert(nftScripts[1] != nftScripts[2]);
        assert(nftScripts[1] != nftScripts[3]);
        assert(nftScripts[2] != nftScripts[3]);
    }

    static createEmptyState(txInputCountMax: typeof TX_INPUT_COUNT_MAX_6 | typeof TX_INPUT_COUNT_MAX_12): CAT721GuardConstState {
        const nftScriptHashes = fill(toByteString(''), NFT_GUARD_COLLECTION_TYPE_MAX)
        // default value to ensure the uniqueness of nft scripts
        nftScriptHashes[0] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF
        nftScriptHashes[1] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE
        nftScriptHashes[2] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD
        nftScriptHashes[3] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC

        
        const nftScriptIndexesArray = fill(-1n, txInputCountMax)
        const nftScriptIndexes = nftScriptIndexesArray.map(index => intToByteString(index, 1n)).join('')

        return {
            deployerAddr: toByteString(''),
            nftScriptHashes: nftScriptHashes,
            nftBurnMasks: '00'.repeat(txInputCountMax),
            nftScriptIndexes,
        }
    }
}
