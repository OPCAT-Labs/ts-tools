import { assert, byteStringToInt, hash160, len, slice, toByteString } from "../../fns/index.js";
import { ByteString } from "../../types/index.js";
import { Hash160Merkle } from "./hash160Merkle.js";
import { HashedMap } from "./hashedMap.js";
import { HashedMapContext, TracedHashedMap } from "./tracedHashedMap.js";


export class HashedMapLibrary<KeyType, ValueType> {
  static readonly HASH_LEN = 20n;
  static readonly DEPTH = 160n;
  static readonly PROOF_LEN = 3220n;


  // HashedMap holds the root of the merkle tree
  private _root: ByteString;

  // injected by typescript sdk
  private _nextRoot: ByteString;
  private _proofs: ByteString;
  private _keys: KeyType[];
  private _leafValues: ValueType[];
  private _nextLeafValues: ValueType[];
  private _accessIndexes: ByteString;

  // temp variable
  private _accessCount: number;
  private _dataFunctionCalled: boolean;

  serializeKey: (key: KeyType) => ByteString;
  serializeValue: (value: ValueType) => ByteString;
  isSameValue: (value: ValueType, value2: ValueType) => boolean;
  maxAccessKeys: number

  constructor(root: ByteString) {
    this._root = root;
  }

  init(proofs: ByteString, keys: KeyType[], leafValues: ValueType[], nextLeafValues: ValueType[], accessIndexes: ByteString): boolean {
    this._proofs = proofs;
    this._keys = keys;
    this._leafValues = leafValues;
    this._nextLeafValues = nextLeafValues;
    this._accessIndexes = accessIndexes;
    this._accessCount = 0;
    this._dataFunctionCalled = false;
    return this.verifyMerkleProof();
  }

  verifyMerkleProof(): boolean {
    // 1. check _proofs length is valid
    // 1.1 check if _proofs length is divisible by PROOF_LEN
    const proofCount = len(this._proofs) / HashedMapLibrary.PROOF_LEN;
    assert(proofCount * HashedMapLibrary.PROOF_LEN == len(this._proofs));
    // 1.2 check if _proofs length is less than maxAccessKeys * PROOF_LEN
    assert(proofCount <= this.maxAccessKeys);

    // 2. check _root, _nextRoot, _leafValues, _nextLeafValues are valid
    let nextRoot = this._root;
    for (let i = 0; i < this.maxAccessKeys; i++) {
      if (i < proofCount) {
        let proof = slice(this._proofs, BigInt(i) * HashedMapLibrary.PROOF_LEN, BigInt(i + 1) * HashedMapLibrary.PROOF_LEN)
        let keyHash = hash160(this.serializeKey(this._keys[i]));
        let leafHash = hash160(this.serializeValue(this._leafValues[i]));
        let nextLeafHash = hash160(this.serializeValue(this._nextLeafValues[i]));
        let expectedLeafHash = slice(proof, 0n, HashedMapLibrary.HASH_LEN);
        let neighbors = slice(proof, HashedMapLibrary.HASH_LEN, HashedMapLibrary.HASH_LEN + HashedMapLibrary.DEPTH * HashedMapLibrary.HASH_LEN);

        // make sure _leafValues[i] is the same as the leafHash in the proof
        assert(expectedLeafHash == leafHash);
        // verify the merkle proof
        nextRoot = this.verifySingleMerkle(nextRoot, keyHash, leafHash, nextLeafHash, neighbors);
      }
    }
    this._nextRoot = nextRoot;
    return true;
  }

  private verifySingleMerkle(root: ByteString, keyHash: ByteString, leafHash: ByteString, nextLeafHash: ByteString, neighbors: ByteString): ByteString {
    let keyNumber = byteStringToInt(keyHash + '00');
    let oldMerkleValue = leafHash;
    let newMerkleValue = nextLeafHash;
    for (let i = 0; i < HashedMapLibrary.DEPTH; i++) {
      let isNeighborLeft = keyNumber % 2n === 1n;
      keyNumber = keyNumber / 2n;
      let neighborItem = slice(neighbors, BigInt(i) * HashedMapLibrary.HASH_LEN, BigInt(i + 1) * HashedMapLibrary.HASH_LEN);
      if (isNeighborLeft) {
        oldMerkleValue = hash160(neighborItem + oldMerkleValue);
        newMerkleValue = hash160(neighborItem + newMerkleValue);
      } else {
        oldMerkleValue = hash160(oldMerkleValue + neighborItem);
        newMerkleValue = hash160(newMerkleValue + neighborItem);
      }
    }
    assert(root == oldMerkleValue);
    return newMerkleValue;
  }

  static verifySingleMerkle(root: ByteString, keyHash: ByteString, leafHash: ByteString, nextLeafHash: ByteString, neighbors: ByteString): ByteString {
    return new HashedMapLibrary<any, any>('').verifySingleMerkle(root, keyHash, leafHash, nextLeafHash, neighbors)
  }

  private accessKey(key: KeyType): bigint {
    let accessIndex = byteStringToInt(slice(this._accessIndexes, BigInt(this._accessCount), BigInt(++this._accessCount)));
    assert(accessIndex >= 0);
    let expectedKeyHash = this.serializeKey(this._keys[Number(accessIndex)]);
    let accessKeyHash = this.serializeKey(key);
    assert(accessKeyHash == expectedKeyHash);
    return accessIndex;
  }

  // public function
  get(key: KeyType): ValueType {
    let accessIndex = this.accessKey(key);
    return this._leafValues[Number(accessIndex)];
  }

  // public function
  set(key: KeyType, value: ValueType): boolean {
    // cannot call \`set\` function after \`data\` function is called
    assert(!this._dataFunctionCalled);
    let accessIndex = this.accessKey(key);
    this._leafValues[Number(accessIndex)] = value;
    return true;
  }

  // public function, called by the end of the public function
  verifyValues(): boolean {
    let proofCount = len(this._proofs) / HashedMapLibrary.PROOF_LEN;
    for (let i = 0; i < this.maxAccessKeys; i++) {
      if (i < proofCount) {
        assert(this.isSameValue(this._leafValues[i], this._nextLeafValues[i]));
      }
    }
    return true;
  }

  // public function
  data(): ByteString {
    this._dataFunctionCalled = true;
    return this._nextRoot;
  }
}



export function verifyHashedMapContext(
  m: TracedHashedMap<any, any, any>,
) {
  const { ctx, operations } = m.extractContext();
  const lib = new HashedMapLibrary(m.beforeMap.getRoot());
  lib.serializeKey = m.serializeKey.bind(m)
  lib.serializeValue = m.serializeValue.bind(m)
  lib.isSameValue = (v1: any, v2: any) => {
    return lib.serializeValue(v1) == lib.serializeValue(v2)
  }
  lib.maxAccessKeys = m.genericType.maxAccessKeys
  lib.init(ctx.proofs, ctx.keys, ctx.leafValues, ctx.nextLeafValues, ctx.accessIndexes)
  operations.forEach(op => {
    if (op.method === 'set') {
      lib.set(op.key, op.value)
    } else if (op.method === 'get') {
      lib.get(op.key)
    }
  })
  return lib.verifyValues()
}

export function verifyHashedMapMerkleProof(
  ctx: HashedMapContext<any, any, any>,
  dummyHashedMap: HashedMap<any, any, any>,
  oldRoot: ByteString,
  newRoot: ByteString,
): boolean {
  const lib = new HashedMapLibrary(oldRoot);
  lib.serializeKey = dummyHashedMap.serializeKey.bind(dummyHashedMap)
  lib.serializeValue = dummyHashedMap.serializeValue.bind(dummyHashedMap)
  lib.isSameValue = (v1: any, v2: any) => {
    return lib.serializeValue(v1) == lib.serializeValue(v2)
  }
  lib.maxAccessKeys = dummyHashedMap.genericType.maxAccessKeys;
  lib.init(ctx.proofs, ctx.keys, ctx.leafValues, ctx.nextLeafValues, ctx.accessIndexes)
  return lib.data() === newRoot;
}
