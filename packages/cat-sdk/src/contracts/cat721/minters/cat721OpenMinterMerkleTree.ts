import { ByteString, SmartContractLib, assert, hash160, intToByteString, len, method, toByteString } from "@opcat-labs/scrypt-ts-opcat";
import { ProofNodePos, MerkleProof, HEIGHT, CAT721MerkleLeaf } from "../types";
import { OUTPUT_DATA_HASH_LEN } from "src/contracts/constants";


export class CAT721OpenMinterMerkleTree extends SmartContractLib {

    
    /**
     * Update leaf in merkle tree
     * @param oldLeaf old leaf to update
     * @param newLeaf new leaf
     * @param proof merkle proof
     * @param proofNodePos proof node position
     * @param merkleRoot merkle root to verify the proof and the leaf
     * @returns the new merkle root
     */
    @method()
    static updateLeaf(
        oldLeaf: ByteString,
        newLeaf: ByteString,
        proof: MerkleProof,
        proofNodePos: ProofNodePos,
        merkleRoot: ByteString,
    ): ByteString {
        let oldRoot = oldLeaf;
        let newRoot = newLeaf;
        for (let i = 0; i < HEIGHT - 1; i++) {
            if (proofNodePos[i]) {
                // proof node is on the right
                oldRoot = hash160(oldRoot + proof[i]);
                newRoot = hash160(newRoot + proof[i]);
            } else {
                oldRoot = hash160(proof[i] + oldRoot);
                newRoot = hash160(proof[i] + newRoot);
            }
        }
        assert(oldRoot == merkleRoot, 'merkle root mismatch');
        return newRoot;
    }

    @method()
    static leafStateHash(leaf: CAT721MerkleLeaf): ByteString {
        return hash160(CAT721OpenMinterMerkleTree.leafPropHashes(leaf));
    }

    @method()
    static checkLeaf(leaf: CAT721MerkleLeaf): void {
        assert(len(leaf.contentDataHash) == OUTPUT_DATA_HASH_LEN);
        assert(leaf.localId >= 0);
    }

    @method()
    static leafPropHashes(leaf: CAT721MerkleLeaf): ByteString {
        CAT721OpenMinterMerkleTree.checkLeaf(leaf);
        const isMined = leaf.isMined ? toByteString('01') : toByteString('00');
        return hash160(leaf.contentDataHash) + hash160(intToByteString(leaf.localId)) + hash160(isMined);
    }
}