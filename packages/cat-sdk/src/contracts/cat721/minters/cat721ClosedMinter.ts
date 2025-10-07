import { assert, BacktraceInfo, ByteString, len, method, prop, PubKey, Sig, SmartContract, toByteString, TxUtils, UInt64 } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721ClosedMinterState, CAT721State } from "../types";
import { OwnerUtils } from "../../utils/ownerUtils";
import { ConstantsLib, OWNER_ADDR_P2PKH_BYTE_LEN } from "../../constants";
import { CAT721StateLib } from "../cat721StateLib";



export class CAT721ClosedMinter extends SmartContract<CAT721ClosedMinterState> {
    @prop()
    issuerAddress: ByteString
    
    @prop()
    genesisOutpoint: ByteString

    @prop()
    max: bigint

    constructor(issuerAddress: ByteString, genesisOutpoint: ByteString, max: bigint) {
        super(...arguments)
        this.issuerAddress = issuerAddress
        this.genesisOutpoint = genesisOutpoint
        this.max = max
    }

    @method()
    public mint(
        // args to mint nft
        nftMint: CAT721State,
        issuerPubKey: PubKey,
        issuerSig: Sig,
        // output satoshis of curTx minter output
        minterSatoshis: UInt64,
        // output satoshis of curTx nft output
        nftSatoshis: UInt64,
        // backtrace
        backtraceInfo: BacktraceInfo,
    ) {
        this.backtraceToOutpoint(backtraceInfo, this.genesisOutpoint);

        // check issuer
        OwnerUtils.checkUserOwner(issuerPubKey, this.issuerAddress);
        assert(this.checkSig(issuerSig, issuerPubKey));

        const nftRemaining = this.state.maxLocalId - this.state.nextLocalId;
        assert(nftRemaining > 0n && nftRemaining <= this.max);

        // minter input should be the first input in curTx
        assert(this.ctx.inputIndex == 0n);

        const nextLocalId = this.state.nextLocalId + 1n;
        let outputs = toByteString('');
        if (nextLocalId < this.state.maxLocalId) {
            outputs += TxUtils.buildDataOutput(
                this.ctx.spentScriptHash,
                minterSatoshis,
                CAT721ClosedMinter.stateHash({
                    tag: ConstantsLib.OPCAT_CAT721_MINTER_TAG,
                    nftScriptHash: this.state.nftScriptHash,
                    maxLocalId: this.state.maxLocalId,
                    nextLocalId: nextLocalId,
                })
            )
        }
        // next nft output
        CAT721StateLib.checkState(nftMint);
        assert(nftMint.localId == this.state.nextLocalId)
        outputs += TxUtils.buildDataOutput(this.state.nftScriptHash, nftSatoshis, CAT721StateLib.stateHash(nftMint))

        // confine curTx outputs
        outputs += this.buildChangeOutput();
        assert(this.checkOutputs(outputs), 'Outputs mismatch with the transaction context');
    }

    
    public checkProps() {
        assert(this.max > 0n, 'max must be greater than 0')
        assert(len(this.issuerAddress) == OWNER_ADDR_P2PKH_BYTE_LEN, 'issuerAddress must be a valid p2pkh address')
    }
}