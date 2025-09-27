import { assert, ByteString, fill, FixedArray, len, method, Ripemd160, sha1, SHA256_HASH_LEN, StateLib, toByteString } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721GuardConstState } from "./types";
import { ConstantsLib, NFT_GUARD_COLLECTION_TYPE_MAX, TX_INPUT_COUNT_MAX } from "../constants";



export class CAT721GuardStateLib extends StateLib<CAT721GuardConstState> {
    @method()
    static formalCheckState(_state: CAT721GuardConstState): ByteString {
        CAT721GuardStateLib.checkNftScriptsUniq(_state.nftScriptHashes)

        for (let i = 0; i < NFT_GUARD_COLLECTION_TYPE_MAX; i++) {
            const scriptLen = len(_state.nftScriptHashes[i]);
            assert(scriptLen == SHA256_HASH_LEN);
        }

        for (let i = 0; i < TX_INPUT_COUNT_MAX; i++) {
            const scriptIndex = _state.nftScriptIndexes[i];
            assert(scriptIndex >= -1 && scriptIndex < NFT_GUARD_COLLECTION_TYPE_MAX);
        }
        return toByteString('')
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

    static createEmptyState(): CAT721GuardConstState {
        const nftScriptHashes = fill(toByteString(''), NFT_GUARD_COLLECTION_TYPE_MAX)
        // default value to ensure the uniqueness of nft scripts
        nftScriptHashes[0] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF
        nftScriptHashes[1] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE
        nftScriptHashes[2] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD
        nftScriptHashes[3] = ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC
        return {
            nftScriptHashes: nftScriptHashes,
            nftBurnMasks: fill(false, TX_INPUT_COUNT_MAX),
            nftScriptIndexes: fill(-1n, TX_INPUT_COUNT_MAX),
        }
    }
}
