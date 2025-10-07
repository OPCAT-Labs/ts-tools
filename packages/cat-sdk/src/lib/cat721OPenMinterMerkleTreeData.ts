import { hash160, Ripemd160 } from "@opcat-labs/scrypt-ts-opcat";
import { CAT721MerkleLeaf } from "../contracts/cat721/types";
import { CAT721OpenMinterMerkleTree } from "../contracts/cat721/minters/cat721OpenMinterMerkleTree";



export const PROOF_NODE_ON_RIGHT = true;
export const PROOF_NODE_ON_LEFT = false;


export class CAT721OpenMinterMerkleTreeData {
    leafArray: CAT721MerkleLeaf[] = [];
    height: number;
    emptyHashs: string[] = [];
    hashNodes: string[][] = [];
    maxLeafSize: number;

    constructor(leafArray: CAT721MerkleLeaf[], height: number) {
        this.height = height;
        this.maxLeafSize = Math.pow(2, this.height - 1);
        this.leafArray = leafArray;
        const emptyHash = hash160('');
        this.emptyHashs.push(emptyHash);
        for (let i = 1; i < height; i++) {
            const prevHash = this.emptyHashs[i - 1];
            this.emptyHashs[i] = hash160(prevHash + prevHash);
        }

        this.buildMerkleTree();
    }

    getLeaf(index: number) {
        return this.leafArray[index];
    }

    get merkleRoot() {
        return this.hashNodes[this.hashNodes.length - 1][0];
    }

    getMerklePath(leafIndex: number): {
        leaf: Ripemd160;
        leafNode: CAT721MerkleLeaf;
        neighbor: string[];
        neighborType: boolean[];
        merkleRoot: string;
    } {
        const leafNode = this.leafArray[leafIndex];
        let prevHash = this.hashNodes[0];
        const neighbor: string[] = [];
        const neighborType: boolean[] = [];

        const leafNodeHash = hash160(CAT721OpenMinterMerkleTree.leafPropHashes(leafNode));
        if (leafIndex < prevHash.length) {
            prevHash[leafIndex] = leafNodeHash;
        } else {
            prevHash.push(leafNodeHash);
        }

        let prevIndex = leafIndex;

        for (let i = 1; i < this.height; i++) {
            prevHash = this.hashNodes[i - 1];
            const curHash = this.hashNodes[i];

            const curIndex = Math.floor(prevIndex / 2);
            // right node
            if (prevIndex % 2 === 1) {
                neighbor.push(prevHash[prevIndex - 1]);
                neighborType.push(PROOF_NODE_ON_LEFT);
            } else {
                // left node
                if (curIndex >= curHash.length) {
                    neighbor.push(this.emptyHashs[i - 1]);
                    neighborType.push(PROOF_NODE_ON_RIGHT);
                } else {
                    if (prevHash.length > prevIndex + 1) {
                        neighbor.push(prevHash[prevIndex + 1]);
                        neighborType.push(PROOF_NODE_ON_RIGHT);
                    } else {
                        neighbor.push(this.emptyHashs[i - 1]);
                        neighborType.push(PROOF_NODE_ON_RIGHT);
                    }
                }
            }
            prevIndex = curIndex;
        }
        neighbor.push('');
        neighborType.push(false);
        return {
            leaf: leafNodeHash,
            leafNode: leafNode,
            neighbor,
            neighborType,
            merkleRoot: this.merkleRoot,
        };
    }

    updateLeaf(leaf: CAT721MerkleLeaf, leafIndex: number) {
        const oldLeaf = this.leafArray[leafIndex];
        this.leafArray[leafIndex] = leaf;
        // return merkle path
        const { neighbor, neighborType } = this.updateMerkleTree(leaf, leafIndex);
        return {
            oldLeaf,
            neighbor,
            neighborType,
            leafIndex,
            newLeaf: leaf,
            merkleRoot: this.merkleRoot,
        };
    }

    updateMerkleTree(leaf: CAT721MerkleLeaf, leafIndex: number) {
        let prevHash = this.hashNodes[0];
        const neighbor: string[] = [];
        const neighborType: boolean[] = [];
        if (leafIndex < prevHash.length) {
            prevHash[leafIndex] = hash160(CAT721OpenMinterMerkleTree.leafPropHashes(leaf));
        } else {
            prevHash.push(hash160(CAT721OpenMinterMerkleTree.leafPropHashes(leaf)));
        }

        let prevIndex = leafIndex;

        for (let i = 1; i < this.height; i++) {
            prevHash = this.hashNodes[i - 1];
            const curHash = this.hashNodes[i];

            const curIndex = Math.floor(prevIndex / 2);
            // right node
            if (prevIndex % 2 === 1) {
                const newHash = hash160(prevHash[prevIndex - 1] + prevHash[prevIndex]);
                curHash[curIndex] = newHash;
                neighbor.push(prevHash[prevIndex - 1]);
                neighborType.push(PROOF_NODE_ON_LEFT);
            } else {
                // left node
                // new add
                let newHash;
                if (curIndex >= curHash.length) {
                    newHash = hash160(prevHash[prevIndex] + this.emptyHashs[i - 1]);
                    if (curHash.length !== curIndex) {
                        throw Error('wrong curHash');
                    }
                    curHash.push(newHash);
                    neighbor.push(this.emptyHashs[i - 1]);
                    neighborType.push(PROOF_NODE_ON_RIGHT);
                } else {
                    if (prevHash.length > prevIndex + 1) {
                        newHash = hash160(prevHash[prevIndex] + prevHash[prevIndex + 1]);
                        neighbor.push(prevHash[prevIndex + 1]);
                        neighborType.push(PROOF_NODE_ON_RIGHT);
                    } else {
                        newHash = hash160(prevHash[prevIndex] + this.emptyHashs[i - 1]);
                        neighbor.push(this.emptyHashs[i - 1]);
                        neighborType.push(PROOF_NODE_ON_RIGHT);
                    }
                    curHash[curIndex] = newHash;
                }
            }
            prevIndex = curIndex;
        }
        neighbor.push('');
        neighborType.push(false);
        return { neighbor, neighborType };
    }

    private buildMerkleTree() {
        this.hashNodes = [];
        let prevHash: string[] = [];
        let curHash: string[] = [];

        for (let i = 0; i < this.leafArray.length; i++) {
            prevHash.push(hash160(CAT721OpenMinterMerkleTree.leafPropHashes(this.leafArray[i])));
        }
        if (prevHash.length > 0) {
            this.hashNodes.push(prevHash);
        } else {
            this.hashNodes.push([this.emptyHashs[0]]);
        }

        for (let i = 1; i < this.height; i++) {
            prevHash = this.hashNodes[i - 1];
            curHash = [];
            for (let j = 0; j < prevHash.length;) {
                if (j + 1 < prevHash.length) {
                    curHash.push(hash160(prevHash[j] + prevHash[j + 1]));
                } else {
                    curHash.push(hash160(prevHash[j] + this.emptyHashs[i - 1]));
                }
                j += 2;
            }
            this.hashNodes.push(curHash);
        }
    }
}