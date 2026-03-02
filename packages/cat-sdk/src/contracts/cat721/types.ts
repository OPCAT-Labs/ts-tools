import { Bool, ByteString, FixedArray, Int32 } from "@opcat-labs/scrypt-ts-opcat"
import { GUARD_TOKEN_TYPE_MAX, NFT_GUARD_COLLECTION_TYPE_MAX } from "../constants.js"

/**
 * The CAT721 state
 * @category CAT721
 * @onchain
 */
export type CAT721State = {
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
    /**
     * The address of the deployer who created this Guard UTXO.
     * Used to authorize the `destroy` method, allowing only the deployer to reclaim the Guard's satoshis.
     * Format: P2PKH locking script (76a914 + hash160(pubKey) + 88ac)
     */
    deployerAddr: ByteString
    nftScriptHashes: FixedArray<ByteString, typeof NFT_GUARD_COLLECTION_TYPE_MAX>;
    // for each input of curTx
    // if the input is an nft and it will be burned, then the value is true
    // otherwise, the value is false by default
    nftBurnMasks: ByteString;
    /**
     * Maps each transaction input to its NFT collection type index in nftScriptHashes array
     * - For NFT inputs: contains the index (0-3) of the collection type in nftScriptHashes
     * - For non-NFT inputs: contains -1 (0x81 in ByteString)
     * - Each index occupies 1 byte
     *
     * @example
     * Given nftScriptIndexes = "810001010081" (hex representation of [-1, 0, 1, 1, 0, -1]):
     * - Input #0: non-NFT (0x81 = -1)
     * - Input #1: NFT collection 0 (nftScriptHashes[0])
     * - Input #2: NFT collection 1 (nftScriptHashes[1])
     * - Input #3: NFT collection 1 (nftScriptHashes[1])
     * - Input #4: NFT collection 0 (nftScriptHashes[0])
     * - Input #5: non-NFT (0x81 = -1)
     */
    nftScriptIndexes: ByteString;
}

/**
 * The CAT721 closed minter state
 * @category CAT721
 * @onchain
 */
export type CAT721ClosedMinterState = {
    nftScriptHash: ByteString
    // before the first-time mint, maxLocalId - nextLocalId = nft max supply
    maxLocalId: bigint
    nextLocalId: bigint
}

/**
 * The height of the merkle tree for CAT721 open minter
 * @onchain
 */
export const HEIGHT = 15;

/**
 * The number of proof elements needed for merkle verification
 * (HEIGHT - 1 because the loop iterates from leaf to root, excluding the root itself)
 * F20 Fix: Proof arrays now match actual on-chain usage
 * @onchain
 */
export const MERKLE_PROOF_HEIGHT = 14;

/**
 * Maximum number of NFTs that can be minted with merkle tree of HEIGHT
 * C7 Fix: Used to validate max parameter
 * @onchain
 */
export const MERKLE_TREE_MAX_CAPACITY = 16384; // 2^14 = 2^(HEIGHT-1)

/**
 * The merkle proof for CAT721 open minter
 * F20 Fix: Uses MERKLE_PROOF_HEIGHT (14) instead of HEIGHT (15) to match on-chain loop
 * @onchain
 */
export type MerkleProof = FixedArray<ByteString, typeof MERKLE_PROOF_HEIGHT>;


/**
 * The proof node position for CAT721 open minter
 * to indicate whether the node in merkle proof is on the left or right
 * if the node is on the right, then the value is true
 * otherwise, the value is false
 * F20 Fix: Uses MERKLE_PROOF_HEIGHT (14) instead of HEIGHT (15) to match on-chain loop
 * @onchain
 */
export type ProofNodePos = FixedArray<boolean, typeof MERKLE_PROOF_HEIGHT>;

/**
 * The merkle leaf for CAT721 open minter
 * @onchain
 */
export type CAT721MerkleLeaf = {
    // content data hash of this nft
    contentDataHash: ByteString
    localId: bigint
    // a flag to indicate whether this nft has been minted before
    hasMintedBefore: boolean
}

/**
 * The CAT721 open minter state
 * @category CAT721
 * @onchain
 */
export type CAT721OpenMinterState = {
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
}

/**
 * The CAT721 metadata for closed minter
 * @category CAT721
 * @category Metadata
 */
export type ClosedMinterCAT721Meta = {
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
}

/**
 * The CAT721 metadata for open minter
 * @category CAT721
 * @category Metadata
 */
export type OpenMinterCAT721Meta = {
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
}