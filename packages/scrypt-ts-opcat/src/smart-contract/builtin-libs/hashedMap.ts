import { ByteString } from '../types/index.js';
import { SmartContractLib } from '../smartContractLib.js';
import { FixedArray, PrimitiveTypes, StructObject, SupportedParamType } from '../types/primitives.js';
import { AbstractContract } from '../abstractContract.js';
import { Artifact } from '../types/artifact.js';
import { ABICoder } from '../abi.js';
import { createEmptyState, serializeState } from '../stateSerializer.js';
import {assert, byteStringToInt, fill, hash160, intToByteString, toByteString } from '../fns/index.js';
import { getUnRenamedSymbol } from '../abiutils.js';



export class AccessTracer<KeyType, ValueType> {

    private _accessKeys: KeyType[] = [];
    private _accessIndexes: number[] = [];

    traceAccess(key: KeyType) {
        const index = this._accessKeys.indexOf(key);
        if (index === -1) {
            this._accessKeys.push(key);
            this._accessIndexes.push(this._accessKeys.length - 1);
        } else {
            this._accessIndexes.push(index);
        }
    }

    startTracing() {
        this._accessKeys = [];
        this._accessIndexes = [];
    }

    stopTracing() {
        return {
            accessKeys: this._accessKeys,
            accessIndexes: this._accessIndexes,
        }
    }
}
export class HashedMap<
    KeyType extends PrimitiveTypes,
    ValueType extends StructObject,
    MaxAccessKeys extends number
> extends Map<KeyType, ValueType> {
    root: ByteString
    private internalMapBefore: Map<KeyType, ValueType>
    private internalMapAfter: Map<KeyType, ValueType>
    private _tracer: AccessTracer<KeyType, ValueType>
    private _contextType: string
    private _artifact: Artifact
    private _genericType: {
        keyType: string,
        valueType: string,
        maxAccessKeys: number,
    }
    private _merkleTree: Hash160Merkle

    /**
     * create/initialize a hashed map with the pairs
     * @param pairs - The pairs of the map
     */
    constructor(pairs: [KeyType, ValueType][]) {
        super();
        this._genericType = {
            keyType: '',
            valueType: '',
            maxAccessKeys: 0,
        }
        this.setPairs(pairs)
    }

    /**
     * Can call it inside a `@method` function
     */
    public get(key: KeyType): ValueType {
        if (!this.internalMapAfter.has(key)) {
            throw new Error('Key not found')
        }

        this._tracer?.traceAccess(key);
        
        return this.internalMapAfter.get(key) as ValueType
    }

    /**
     * Can call it inside a `@method` function
     */
    public set(key: KeyType, value: ValueType) {
        this.internalMapAfter.set(key, value);
        this._tracer?.traceAccess(key);
        return this;
    }

    /**
     * create a hashed map from the root, usually used when the map is created in the smart contract and the root is provided
     * after the map is created, you can call setPairs to restore the whole map
     * @ignore
     */
    static fromRoot<
        KeyType extends PrimitiveTypes,
        ValueType extends StructObject,
        MaxAccessKeys extends number
    >(
        this: { new(...args: any[]): HashedMap<KeyType, ValueType, MaxAccessKeys> },
        root: ByteString,
    ) {
        const map = new HashedMap<KeyType, ValueType, MaxAccessKeys>([]);
        map.root = root;
        return map;
    }

    /**
     * set the pairs to the map and verify the merkle tree root
     */
    public setPairs(pairs: [KeyType, ValueType][]) {
        this.internalMapBefore = new Map(pairs)
        this.internalMapAfter = new Map(pairs);

        // this._merkleTree = new Hash160Merkle(this.serializeValue(this.emptyValue()));
        // this._merkleTree.setPairs(pairs.map(p => [this.serializeKey(p[0]), this.serializeValue(p[1])]));

        // const merkleRoot = this._merkleTree.getRoot();
        // if (this.root) {
        //     assert(merkleRoot === this.root, 'Merkle tree root mismatch');
        // }
        // this.root = merkleRoot;
    }

    /**
     * @ignore
     */
    public attachTo(contextType: string, artifact: Artifact) {
        this._contextType = contextType;
        this._artifact = artifact;

        const { keyType, valueType, maxAccessKeys } = parseCtxType(artifact, contextType);
        this._genericType = {
            keyType,
            valueType,
            maxAccessKeys,
        }
        this._tracer = new AccessTracer<KeyType, ValueType>();
    }


    /**
     * @ignore
     * serialize the key to the byte string
     */
    private serializeKey(key: KeyType): ByteString {
        this.assertAttached();
        switch(typeof key) {
            case 'number':
            case 'bigint':
                return intToByteString(key);
            case 'boolean':
                return key ? '01' : '';
            case 'string':
                return toByteString(key);
            default:
                throw new Error(`Unsupported key type: ${typeof key}`);
        }
    }

    /**
     * @ignore
     * serialize the value to the byte string
     */
    private serializeValue(value: ValueType): ByteString {
        this.assertAttached();
        return serializeState(this._artifact, this._genericType.valueType, value)
    }

    /**
     * @ignore
     * create an empty value, used for the fixed array empty values and the merkle tree
     */
    private emptyValue(): ValueType {
        this.assertAttached();
        return createEmptyState(this._artifact, this._genericType.valueType)
    }

    /**
     * @ignore
     * create an empty key, used for the fixed array empty values
     */
    private emptyKey(): KeyType {
        this.assertAttached();
        switch(typeof this._genericType.keyType) {
            case 'number':
            case 'bigint':
                return 0n as KeyType;
            case 'boolean':
                return false as KeyType;
            case 'string':
                return '' as KeyType;
            default:
                throw new Error(`Unsupported key type: ${typeof this._genericType.keyType}`);
        }
    }


    private assertAttached() {
        if (!this._contextType || !this._artifact) {
            throw new Error('HashedMap is not attached to a context');
        }
    }

    extractContext(): {
        proofs: ByteString,
        keys: FixedArray<KeyType, MaxAccessKeys>,
        leafValues: FixedArray<ValueType, MaxAccessKeys>,
        nextLeafValues: FixedArray<ValueType, MaxAccessKeys>,
        accessIndexes: ByteString,
    } {
        this.assertAttached();

        let proofs = toByteString('')
        
        const { accessKeys, accessIndexes: accessIndexesArray } = this._tracer.stopTracing();

        // 127 is the max length of the access indexes
        // here we use 1 byte to store the accessIndex
        // cause the max uint8 is 127, so the max access keys is 127
        assert(accessKeys.length <= 127, 'Access keys length exceeds 127');
        assert(accessKeys.length <= this._genericType.maxAccessKeys, 'Access keys length exceeds max access keys');

        const keys = fill(this.emptyKey(), this._genericType.maxAccessKeys) as FixedArray<KeyType, MaxAccessKeys>;
        const leafValues = fill(this.emptyValue(), this._genericType.maxAccessKeys) as FixedArray<ValueType, MaxAccessKeys>;
        const nextLeafValues = fill(this.emptyValue(), this._genericType.maxAccessKeys) as FixedArray<ValueType, MaxAccessKeys>;

        for (let i = 0; i < accessKeys.length; i++) {
            const key = accessKeys[i];
            const leafValue = this.internalMapAfter.get(key) as ValueType;
            const nextLeafValue = this.internalMapBefore.get(key) as ValueType;

            keys[i] = key;
            leafValues[i] = leafValue;
            nextLeafValues[i] = nextLeafValue;

            const proof = this._merkleTree.updateLeaf(this.serializeKey(key), this.serializeValue(leafValue));
            proofs += proof.join('');
        }
        const accessIndexes = accessIndexesArray.map(i => intToByteString(BigInt(i))).join('');

        return {
            proofs,
            keys,
            leafValues,
            nextLeafValues,
            accessIndexes,
        }
    }


    // dummy fields for the compiler
    protected __hashed_map_dummy_key__: KeyType
    protected __hashed_map_dummy_value__: ValueType
    protected __hashed_map_dummy_max_access_keys__: MaxAccessKeys
}

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

    updateLeaf(keyValue: string, leafValue: string) {
        this._keyValues.set(keyValue, leafValue);
        const leafHash = this.hash160(leafValue);
        const keyHash = this.hash160(keyValue);
        let keyNumber = byteStringToInt(keyHash + '00');

        this.setLevelHash(0, keyNumber, leafHash);

        // todo, remove leafHash from proofs
        const proofs: Hash[] = [leafHash];

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


export function attachToStateType(
    artifact: Artifact,
    state: any,
) {
   const stateType = artifact.stateType!
   if (!stateType) {
    throw new Error('`stateType` field not found in artifact');
   }
   const abiCoder = new ABICoder(artifact);
   const fields = abiCoder.flattenStruct(state, stateType);
   fields.forEach(field => {
    const fieldType = getUnRenamedSymbol(field.type);
    const isHashedMapNameField = field.name.endsWith('._root') && field.type === 'bytes';
    const hashedMapFieldName = field.name.slice('flattened_struct.'.length, -'._root'.length);
    const hashedMapValue = getFieldValue(hashedMapFieldName, state) as HashedMap<any, any, any>;
    const isHashedMapField = isHashedMapNameField && hashedMapValue instanceof HashedMap;

    if (isHashedMapField) {
        // this is the hashed map field
        const fieldCtxType = findCtxType(artifact, hashedMapFieldName);
        hashedMapValue.attachTo(fieldCtxType, artifact);
    }
   })
}

function getFieldValue(fieldName: string, state: any) {
    const fields = fieldName.split('.');
    let cur = state;
    for (const field of fields) {
        cur = cur[field];
    }
    return cur;
}

function findCtxType(artifact: Artifact, fieldName: string) {
    const ctxFieldName = `__scrypt_ts_nextState__dot__${fieldName.replaceAll('.', '__dot__')}__ctx`;
    const param = artifact.abi.map(v => v.params).flat().find(p => p.name === ctxFieldName);
    if (!param) {
        throw new Error(`Context type ${ctxFieldName} not found in artifact`);
    }
    return param.type;
}

function parseCtxType(artifact: Artifact, ctxType: string) {
    const ctxStruct = artifact.structs.find(s => s.name === ctxType);
    if (!ctxStruct) {
        throw new Error(`Context type ${ctxType} not found in artifact`);
    }
    const keyType = ctxStruct.params.find(p => p.name === 'keys')?.type.split('[')[0];
    if (!keyType) {
        throw new Error(`Key type not found in context type ${ctxType}`);
    }
    const valueType = ctxStruct.params.find(p => p.name === 'leafValues')?.type.split('[')[0];
    if (!valueType) {
        throw new Error(`Value type not found in context type ${ctxType}`);
    }
    const maxAccessKeys = +ctxStruct.params.find(p => p.name === 'keys')?.type.split('[')[1].split(']')[0];
    if (!maxAccessKeys) {
        throw new Error(`Max access keys not found in context type ${ctxType}`);
    }
    return { keyType, valueType, maxAccessKeys };
}

new Hash160Merkle('00').updateLeaf('01', '02');