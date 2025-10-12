import { ConstantsLib, NFT_GUARD_COLLECTION_TYPE_MAX, OUTPUT_LOCKING_SCRIPT_HASH_LEN, TX_INPUT_COUNT_MAX, TX_OUTPUT_COUNT_MAX } from "../constants";
import { StateHashes } from "../types";
import { CAT721GuardStateLib } from "./cat721GuardStateLib";
import { CAT721StateLib } from "./cat721StateLib";
import { CAT721GuardConstState, CAT721State } from "./types";
import { ByteString, ContextUtils, FixedArray, SmartContract, StdUtils, TxUtils, assert, byteStringToInt, fill, hash160, intToByteString, len, method, toByteString } from "@opcat-labs/scrypt-ts-opcat";

export class CAT721Guard extends SmartContract<CAT721GuardConstState> {
    @method()
    public unlock(
        nextStateHashes: StateHashes,
        // the logic is the same as cat20 guard
        ownerAddrOrScriptHashes: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>,
        // localId list of curTx nft outputs
        // note that the element index of this array does NOT correspond to the outputIndex of curTx nft output
        // and the order of nft outputs MUST be the same as the order of nft inputs excluding the burned ones
        // e.g.
        // this.state.nftScripts        ['nftA', 'nftB', 'fd', 'fc']
        // this.state.nftScriptIndexes  [0, 0, 1, -1, -1, -1]
        // -> input nfts in curTx     [nftA_20, nftA_21, nftB_10, /, /, /]
        // this.state.burnMasks         [false, true, false, false, false, false]
        // output nftScriptIndexes    [-1, 0, 1, -1, -1]
        // -> output nfts in curTx    [/, nftA_20, nftB_10, /, /]
        // -> outputLocalIds
        //        correct             [20, 10, -1, -1, -1]
        //        invalid             [-1, 20, 10, -1, -1]
        outputLocalIds: FixedArray<bigint, typeof TX_OUTPUT_COUNT_MAX>,
        nftScriptHashIndexes: FixedArray<bigint, typeof TX_OUTPUT_COUNT_MAX>,
        outputSatoshis: FixedArray<bigint, typeof TX_OUTPUT_COUNT_MAX>,
        cat721States: FixedArray<CAT721State, typeof TX_INPUT_COUNT_MAX>,
        // the number of curTx outputs except for the state hash root output
        outputCount: bigint
    ) {
        CAT721GuardStateLib.formalCheckState(this.state);

        // how many different types of nfts in curTx inputs
        let inputNftTypes = 0n;
        const nftScriptPlaceholders: FixedArray<ByteString, typeof NFT_GUARD_COLLECTION_TYPE_MAX> = [
            ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FF,
            ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FE,
            ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FD,
            ConstantsLib.TOKEN_SCRIPT_HASH_PLACEHOLDER_FC,
        ];
        for (let i = 0; i < NFT_GUARD_COLLECTION_TYPE_MAX; i++) {
            if (this.state.nftScriptHashes[i] != nftScriptPlaceholders[i]) {
                inputNftTypes++;
            }
        }
        // ensure there are no placeholders between valid nft scripts in curState.nftScriptHashes
        for (let i = 0; i < NFT_GUARD_COLLECTION_TYPE_MAX; i++) {
            if (i < Number(inputNftTypes)) {
                assert(this.state.nftScriptHashes[i] != nftScriptPlaceholders[i], 'nft script hash is invalid, should not be placeholder')
                assert(len(this.state.nftScriptHashes[i]) == OUTPUT_LOCKING_SCRIPT_HASH_LEN, 'nft script hash length is invalid')
            } else {
                assert(this.state.nftScriptHashes[i] == nftScriptPlaceholders[i], 'nft script hash is invalid, should be placeholder')
            }
        }
        assert(inputNftTypes > 0n, 'input nft types should be greater than 0');

        // go through input nfts;
        let nftScriptIndexMax = -1n;
        // nextNfts are all the input nfts except the burned ones
        const nextNfts: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX> = fill(toByteString(''), TX_OUTPUT_COUNT_MAX);
        let nextNftCount = 0n;
        const inputCount = this.ctx.inputCount;
        for (let i = 0n; i < TX_INPUT_COUNT_MAX; i++) {
            const nftScriptIndex = this.state.nftScriptIndexes[Number(i)];
            if (i < inputCount) {
                assert(nftScriptIndex < inputNftTypes);
                if (nftScriptIndex != -1n) {
                    // this is a nft input
                    const nftScriptHash = this.state.nftScriptHashes[Number(nftScriptIndex)];
                    assert(nftScriptHash == ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, BigInt(i)), 'nft script hash is invalid');
                    CAT721StateLib.checkState(cat721States[Number(i)]);
                    assert(ContextUtils.getSpentDataHash(this.ctx.spentDataHashes, BigInt(i)) == CAT721StateLib.stateHash(cat721States[Number(i)]), 'nft state hash is invalid');
                    nftScriptIndexMax = nftScriptIndex > nftScriptIndexMax ? nftScriptIndex : nftScriptIndexMax;
                    if (!this.state.nftBurnMasks[Number(i)]) {
                        // this nft is not burned
                        nextNfts[Number(nextNftCount)] = nftScriptHash + hash160(intToByteString(cat721States[Number(i)].localId))
                        nextNftCount++;
                    }
                } else {
                    // this is a non-nft input
                    assert(!this.state.nftBurnMasks[Number(i)], 'nft burn mask is invalid');
                }
            } else {
                assert(this.state.nftScriptIndexes[Number(i)] == -1n, 'nft script index is invalid');
            }
        }
        assert(nftScriptIndexMax >= 0n && nftScriptIndexMax == inputNftTypes - 1n, 'nft script index max is invalid');

        // build curTx outputs
        assert(outputCount >= 0n && outputCount <= TX_OUTPUT_COUNT_MAX, 'output count is invalid');
        let outputNftCount = 0n;
        let outputs = toByteString('');
        for (let i = 0n; i < TX_OUTPUT_COUNT_MAX; i++) {
            if (i < outputCount) {
                const ownerAddrOrScriptHash = ownerAddrOrScriptHashes[Number(i)];
                assert(len(ownerAddrOrScriptHash) > 0n, 'owner addr or script hash is invalid, should not be empty');
                const nftScriptIndex = nftScriptHashIndexes[Number(i)];
                assert(nftScriptIndex < inputNftTypes, 'nft script index is invalid');
                if (nftScriptIndex != -1n) {
                    // this is an nft output
                    const nftScriptHash = this.state.nftScriptHashes[Number(nftScriptIndex)];
                    const localId = outputLocalIds[Number(outputNftCount)];
                    assert(localId >= 0n, 'local id is invalid');
                    assert(nextNfts[Number(outputNftCount)] == nftScriptHash + hash160(intToByteString(localId)), 'next nft is invalid');
                    outputNftCount = outputNftCount + 1n;
                    const nftStateHash = CAT721StateLib.stateHash({
                        tag: ConstantsLib.OPCAT_CAT721_TAG,
                        ownerAddr: ownerAddrOrScriptHash,
                        localId: localId,
                    });
                    assert(nextStateHashes[Number(i)] == nftStateHash, 'next state hash is invalid');
                    outputs += TxUtils.buildDataOutput(
                        this.state.nftScriptHashes[Number(nftScriptIndex)],
                        outputSatoshis[Number(i)],
                        nftStateHash
                    )
                } else {
                    // this is a non-nft output
                    // locking script of this non-nft output cannot be the same as any nft script in curState
                    for (let j = 0; j < NFT_GUARD_COLLECTION_TYPE_MAX; j++) {
                        assert(ownerAddrOrScriptHash != this.state.nftScriptHashes[j], 'owner addr or script hash is invalid');
                    }
                    outputs += TxUtils.buildDataOutput(
                        ownerAddrOrScriptHash,
                        outputSatoshis[Number(i)],
                        nextStateHashes[Number(i)]
                    )
                }
            } else {
                assert(len(ownerAddrOrScriptHashes[Number(i)]) == 0n, 'owner addr or script hash is invalid, should be 0');
                assert(nftScriptHashIndexes[Number(i)] == -1n)
                assert(outputLocalIds[Number(i)] == -1n, 'output local id is invalid, should be -1');
                assert(nextStateHashes[Number(i)] == toByteString(''), 'next state hash is invalid, should be empty');
                assert(outputSatoshis[Number(i)] == 0n, 'output satoshis is invalid, should be 0');
            }
        }
        // ensure outputLocalIds is default value when there are no more output nfts
        for (let i = 0; i < TX_OUTPUT_COUNT_MAX; i++) {
            if (i >= outputNftCount) {
                assert(outputLocalIds[Number(i)] == -1n, 'output local id is invalid, should be -1');
            }
        }

        // check nft consistency of inputs and outputs
        assert(nextNftCount == outputNftCount, 'next nft count is invalid');

        // confine curTx outputs
        assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
    }
}