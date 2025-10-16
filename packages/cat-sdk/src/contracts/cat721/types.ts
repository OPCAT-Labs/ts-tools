import { Bool, ByteString, FixedArray, Int32 } from "@opcat-labs/scrypt-ts-opcat"
import { GUARD_TOKEN_TYPE_MAX, NFT_GUARD_COLLECTION_TYPE_MAX, TX_INPUT_COUNT_MAX } from "../constants"

/**
 * The CAT721 state
 * @category CAT721
 * @onchain
 */
export type CAT721State = {
    tag: ByteString
    // owner(user/contract) address, p2pkh script or sha256(lockingScript)
    ownerAddr: ByteString
    // token index
    localId: bigint
}

/**
 * The CAT721 guard constant state
 * @category CAT721
 * @onchain
 */
export type CAT721GuardConstState = {
    nftScriptHashes: FixedArray<ByteString, typeof NFT_GUARD_COLLECTION_TYPE_MAX>;
    // for each input of curTx
    // if the input is an nft and it will be burned, then the value is true
    // otherwise, the value is false by default
    nftBurnMasks: FixedArray<Bool, typeof TX_INPUT_COUNT_MAX>;
    nftScriptIndexes: FixedArray<bigint, typeof TX_INPUT_COUNT_MAX>;
}

/**
 * The CAT721 closed minter state
 * @category CAT721
 * @onchain
 */
export type CAT721ClosedMinterState = {
    tag: ByteString
    nftScriptHash: ByteString
    // before the first-time mint, maxLocalId - nextLocalId = nft max supply
    maxLocalId: bigint
    nextLocalId: bigint
}

/**
 * The height of the merkle proof for CAT721 open minter
 * @onchain
 */
export const HEIGHT = 15;

/**
 * The merkle proof for CAT721 open minter
 * @onchain
 */
export type MerkleProof = FixedArray<ByteString, typeof HEIGHT>;


/**
 * The proof node position for CAT721 open minter
 * to indicate whether the node in merkle proof is on the left or right
 * if the node is on the right, then the value is true
 * otherwise, the value is false
 * @onchain
 */
export type ProofNodePos = FixedArray<boolean, typeof HEIGHT>;

/**
 * The merkle leaf for CAT721 open minter
 * @onchain
 */
export type CAT721MerkleLeaf = {
    // content data hash of this nft
    contentDataHash: ByteString
    localId: bigint
    // todo: maybe we should change the field name to `isMinted`
    // a flag to indicate whether this nft is mined
    isMined: boolean
}

/**
 * The CAT721 open minter state
 * @category CAT721
 * @onchain
 */
export type CAT721OpenMinterState = {
    tag: ByteString
    nftScriptHash: ByteString
    // init merkle root
    merkleRoot: ByteString
    // next mint local id
    nextLocalId: bigint
}

/**
 * The CAT721 metadata
 * @category CAT721
 * @category Metadata
 */
export type CAT721Metadata = {
    // name of the CAT721 collection
    name: ByteString
    // symbol of the CAT721 collection
    symbol: ByteString
    // description of the CAT721 collection
    description: ByteString
    // max supply of the CAT721 collection
    max: bigint
    // icon of the CAT721 collection
    icon: ByteString
    // md5 of the CAT721 token minter contract
    minterMd5: ByteString
}

/**
 * The CAT721 metadata for closed minter
 * @category CAT721
 * @category Metadata
 */
export type ClosedMinterCAT721Meta = {
    // tag of the CAT721 collection minter contract
    tag: ByteString
    // name of the CAT721 collection
    name: ByteString
    // symbol of the CAT721 collection
    symbol: ByteString
    // description of the CAT721 collection
    description: ByteString
    // max supply of the CAT721 collection
    max: bigint
    // issuer address
    issuerAddress: ByteString
    // icon of the CAT721 collection
    icon: ByteString
    // md5 of the CAT721 token minter contract
    minterMd5: ByteString
}

/**
 * The CAT721 metadata for open minter
 * @category CAT721
 * @category Metadata
 */
export type OpenMinterCAT721Meta = {
    tag: ByteString
    //  name of the CAT721 collection
    name: ByteString
    // symbol of the CAT721 collection
    symbol: ByteString
    // description of the CAT721 collection
    description: ByteString
    // max supply of the CAT721 collection
    max: bigint
    // --------------- new field ---------------
    // premine of the CAT721 collection
    premine: bigint
    // preminer address of the CAT721 collection
    preminerAddr: ByteString
    // --------------- new field ---------------
    // icon of the CAT721 collection
    icon: ByteString
    // md5 of the CAT721 token minter contract
    minterMd5: ByteString
}