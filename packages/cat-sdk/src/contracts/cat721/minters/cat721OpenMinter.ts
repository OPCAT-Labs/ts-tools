import { assert, BacktraceInfo, ByteString, ContextUtils, len, method, prop, PubKey, Sig, SmartContract, tags, toByteString, TxUtils, UInt64 } from "@opcat-labs/scrypt-ts-opcat"
import { CAT721OpenMinterState, CAT721State, MerkleProof, ProofNodePos, MERKLE_TREE_MAX_CAPACITY } from "../types.js"
import { ConstantsLib, MINTER_INPUT_INDEX, OWNER_ADDR_P2PKH_BYTE_LEN } from "../../constants.js"
import { CAT721StateLib } from "../cat721StateLib.js"
import { OwnerUtils } from "../../utils/ownerUtils.js"
import { CAT721OpenMinterMerkleTree } from "./cat721OpenMinterMerkleTree.js"
import { CAT721OpenMintInfo, CAT721OpenMintInfoState } from "./cat721OpenMintInfo.js"
import { CatTags } from "../../catTags.js"


/**
 * The CAT721 open minter contract
 * @category Contract
 * @category CAT721
 * @notice Premine NFTs are controlled by preminer's signature
 * @notice Preminer can mint to any address during premine phase
 * @onchain
 */
@tags([CatTags.CAT721_MINTER_TAG])
export class CAT721OpenMinter extends SmartContract<CAT721OpenMinterState> {
    @prop()
    genesisOutpoint: ByteString

    @prop()
    max: bigint

    @prop()
    premine: bigint

    @prop()
    preminerAddr: ByteString

    constructor(genesisOutpoint: ByteString, max: bigint, premine: bigint, preminerAddr: ByteString) {
        super(...arguments)
        this.genesisOutpoint = genesisOutpoint
        this.max = max
        this.premine = premine
        this.preminerAddr = preminerAddr
        // Validate in constructor so that any attempt to instantiate an over-capacity
        // minter fails early, both in tests and in the SDK. MAX_OPEN_MINTER_NFT_COUNT
        // is a plain constant (not computed with **) to avoid exponentiation inside
        // the constructor.
        assert(this.max <= BigInt(MERKLE_TREE_MAX_CAPACITY), 'max exceeds merkle tree capacity of 2^(HEIGHT-1)')
        assert(this.premine >= 0n && this.premine <= this.max, 'premine must be greater or equal to 0 and less than or equal to max')
        if (this.premine > 0n) {
            assert(len(this.preminerAddr) == OWNER_ADDR_P2PKH_BYTE_LEN, 'preminerAddr must be set')
        }
    }

    @method()
    public mint(
        // args to mint nft
        nftMint: CAT721State,
        openMintInfo: CAT721OpenMintInfoState,
        proof: MerkleProof,
        proofNodePos: ProofNodePos,
        // premine related args
        preminerPubKey: PubKey,
        preminerSig: Sig,
        // output satoshis of curTx minter output
        minterSatoshis: UInt64,
        // output satoshis of curTx nft output
        nftSatoshis: UInt64,
        // backtrace
        backtraceInfo: BacktraceInfo,
    ) {
        // back to genesis
        this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint);

        assert(this.state.nextLocalId < this.max, 'next local id must be less than max');

        // minter input should be the first input in curTx
        assert(this.ctx.inputIndex == MINTER_INPUT_INDEX, 'minter input should be the first input in curTx');

        // F1 Fix: Validate inputCount bounds before accessing hardcoded indices 1 and 2
        assert(this.ctx.inputCount >= 3n, 'at least 3 inputs required for minting');

        // input1.utxo.data store the nft contents, images, etc.
        const input1StateHash = ContextUtils.getSpentDataHash(this.ctx.spentDataHashes, 1n);
        assert(input1StateHash == openMintInfo.contentDataHash, 'input1 state hash mismatch');
        // input2.utxo.data store localId, the sha256(nft contents)
        const input2StateHash = ContextUtils.getSpentDataHash(this.ctx.spentDataHashes, 2n);
        assert(input2StateHash == CAT721OpenMintInfo.stateHash(openMintInfo), 'input2 state hash mismatch');
        assert(openMintInfo.localId == nftMint.localId, 'open mint info local id mismatch');

        const merkleRoot = CAT721OpenMinterMerkleTree.updateLeaf(
            CAT721OpenMinterMerkleTree.leafStateHash({
                contentDataHash: openMintInfo.contentDataHash,
                localId: openMintInfo.localId,
                hasMintedBefore: false,
            }),
            CAT721OpenMinterMerkleTree.leafStateHash({
                contentDataHash: openMintInfo.contentDataHash,
                localId: openMintInfo.localId,
                hasMintedBefore: true
            }),
            proof,
            proofNodePos,
            this.state.merkleRoot
        )

        const nextLocalId = this.state.nextLocalId + 1n;
        let outputs = toByteString('');
        if (nextLocalId < this.max) {
            // F-03 Fix: Ensure minter satoshis is positive
            assert(minterSatoshis > 0n, 'minter satoshis must be positive');
            outputs += TxUtils.buildDataOutput(
                this.ctx.spentScriptHash,
                minterSatoshis,
                CAT721OpenMinter.stateHash({
                    nftScriptHash: this.state.nftScriptHash,
                    merkleRoot: merkleRoot,
                    nextLocalId: nextLocalId,
                })
            )
        }
        // next nft output
        CAT721StateLib.checkState(nftMint);
        assert(nftMint.localId == this.state.nextLocalId, 'nft local id mismatch');
        // F-03 Fix: Ensure nft satoshis is positive
        assert(nftSatoshis > 0n, 'nft satoshis must be positive');
        outputs += TxUtils.buildDataOutput(this.state.nftScriptHash, nftSatoshis, CAT721StateLib.stateHash(nftMint));
        if (nftMint.localId < this.premine) {
            // preminer checkSig
            OwnerUtils.checkUserOwner(preminerPubKey, this.preminerAddr)
            assert(this.checkSig(preminerSig, preminerPubKey), 'preminer sig check failed');
        }

        // confine curTx outputs
        outputs += this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
    }

}