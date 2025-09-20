import { byteStringToInt, hash160 } from "../../fns/index.js";

type Level = number;
type Hash = string;
type LevelIndex = bigint;


export class Hash160Merkle {

    static readonly DEPTH = 160;

    // each level's hash when the whole tree is empty, length = DEPTH + 1;;
    // _emptyHashes[0] is the leaf hash;
    // _emptyHashes[DEPTH] is the root hash;
    private _emptyHashes: Hash[] = [];

    // each level's hash when the whole tree is not empty, length = DEPTH + 1;
    // Level means the level of the tree, 0 is the leaf level, DEPTH is the root level;
    // LevelIndex means the index of the node in the level, 0 is the leftmost node, DEPTH is the rightmost node;
    // _levelHashes[1][2] is the hash at the 3rd node in the 2nd level;
    private _levelHashes: Map<Level, Map<LevelIndex, Hash>> = new Map();

    // the empty value
    private _emptyValue: string;

    // all non-empty key-value pairs
    private _keyValues: Map<string, string> = new Map();

    constructor(
        emptyValue: string,
        pairs?: [string, string][]
    ) {
        this._emptyValue = emptyValue;
        this.setEmptyHashes(emptyValue);
        this._levelHashes = new Map();
        this.setPairs(pairs || []);
    }

    private setEmptyHashes(emptyValue: string) {
        const emptyHash = this.hash160(emptyValue);
        this._emptyHashes.push(emptyHash);
        for (let i = 0; i < Hash160Merkle.DEPTH; i++) {
            this._emptyHashes.push(this.hash160(this._emptyHashes[i] + this._emptyHashes[i]));
        }
    }

    setPairs(pairs: [string, string][]) {
        for (const [key, value] of pairs) {
            this.updateLeaf(key, value);
        }
    }

    updateLeaf(keyValue: string, leafValue: string, log: boolean = false) {
        const oldLeafValue = this._keyValues.has(keyValue) ? this._keyValues.get(keyValue) : this._emptyValue;
        const oldLeafHash = this.hash160(oldLeafValue);
        this._keyValues.set(keyValue, leafValue);
        const leafHash = this.hash160(leafValue);
        const keyHash = this.hash160(keyValue);
        let keyNumber = byteStringToInt(keyHash + '00');

        this.setLevelHash(0, keyNumber, leafHash);
        // todo, remove leafHash from proofs
        const proofs: Hash[] = [oldLeafHash];

        for (let i = 0; i < Hash160Merkle.DEPTH; i++) {
            const curLevel = i;
            let hash: Hash;
            const isNeighborLeft = keyNumber % 2n === 1n;
            if (isNeighborLeft) {
                const neighborIndex = keyNumber - 1n;
                const neighborHash = this.getLevelHash(curLevel, neighborIndex);
                const curHash = this.getLevelHash(curLevel, keyNumber);
                hash = this.hash160(neighborHash + curHash);
                proofs.push(neighborHash);
            } else {
                const neighborIndex = keyNumber + 1n;
                const neighborHash = this.getLevelHash(curLevel, neighborIndex);
                const curHash = this.getLevelHash(curLevel, keyNumber);
                hash = this.hash160(curHash + neighborHash);
                proofs.push(neighborHash);
            }
            const nextLevel = curLevel + 1;
            const nextKeyNumber = keyNumber / 2n;
            this.setLevelHash(nextLevel, nextKeyNumber, hash);
            keyNumber = nextKeyNumber;
        }
        return proofs;
    }

    getRoot(): Hash {
        return this.getLevelHash(Hash160Merkle.DEPTH, 0n);
    }

    private setLevelHash(level: Level, levelIndex: LevelIndex, hash: Hash) {
        if (!this._levelHashes.has(level)) {
            this._levelHashes.set(level, new Map());
        }
        this._levelHashes.get(level).set(levelIndex, hash);
    }

    private getLevelHash(level: Level, levelIndex: LevelIndex) {
        if (!this._levelHashes.has(level)) {
            return this._emptyHashes[level];
        }
        if (!this._levelHashes.get(level).has(levelIndex)) {
            return this._emptyHashes[level];
        }
        return this._levelHashes.get(level).get(levelIndex);
    }

    hash160(value: string) {
        return hash160(value);
    }
}