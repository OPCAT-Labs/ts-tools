import { ABICoder } from "../../abi.js"
import { getUnRenamedSymbol } from "../../abiutils.js"
import { assert, intToByteString, toByteString } from "../../fns/index.js"
import { createEmptyState, serializeState } from "../../stateSerializer.js"
import { ByteString } from "../../types/index.js"
import { Artifact } from "../../types/artifact.js"
import { PrimitiveTypes, StructObject } from "../../types/primitives.js"
import { Hash160Merkle } from "./hash160Merkle.js"

export class AnotherMap<K, V> {
    private map: Map<K, V> = new Map();
    constructor(pairs: [K, V][]) {
        this.map = new Map(pairs);
    }
  get(key: K): V {
    return this.map.get(key);
  }
  set(key: K, value: V) {
    this.map.set(key, value);
  }
  clear() {
    this.map.clear();
  }
  entries() {
    return this.map.entries();
  }
}

export class HashedMap<
    KeyType extends PrimitiveTypes,
    ValueType extends StructObject,
    MaxAccessKeys extends number
> extends AnotherMap<KeyType, ValueType> {
    private root: ByteString
    genericType: {
        keyType: string,
        valueType: string,
        maxAccessKeys: number,
    }
    private _contextType: string
    private _artifact: Artifact

    static readonly DUMMY_EMPTY_ROOT = '00'.repeat(20);

    /**
     * create/initialize a hashed map with the pairs
     * @param pairs - The pairs of the map
     */
    constructor(pairs: [KeyType, ValueType][]) {
        super(pairs);
        this.genericType = {
            keyType: '',
            valueType: '',
            maxAccessKeys: 0,
        }
    }

    /**
     * Can call it inside a `@method` function
     */
    public get(key: KeyType): ValueType {
        return super.get(key) as ValueType
    }

    /**
     * Can call it inside a `@method` function
     */
    public set(key: KeyType, value: ValueType) {
        super.set(key, value);
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
     * @ignore
     * set the pairs to the map and verify the merkle tree root
     */
    public setPairs(pairs: [KeyType, ValueType][]) {
        super.clear()
        pairs.forEach(([key, value]) => {
            super.set(key, value);
        })

        this.assertAttached()

        const merkleTree = new Hash160Merkle(this.serializeValue(this.emptyValue()));
        merkleTree.setPairs(pairs.map(p => [this.serializeKey(p[0]), this.serializeValue(p[1])]));
        const merkleRoot = merkleTree.getRoot();
        if (this.root) {
            assert(merkleRoot === this.root, 'Merkle tree root mismatch');
        }
    }

    /**
     * @ignore
     * get the root of the merkle tree
     */
    getRoot() {
        const merkleTree = new Hash160Merkle(this.serializeValue(this.emptyValue()));
        merkleTree.setPairs(Array.from(this.entries()).map(p => [this.serializeKey(p[0]), this.serializeValue(p[1])]));
        this.root = merkleTree.getRoot();
        return this.root;
    }

    /**
     * used by the typeResolver to get the root of the merkle tree
     */
    private get _root() {
        // if (!this.genericType) {
        //     return HashedMap.DUMMY_EMPTY_ROOT;
        // }
        return this.getRoot();
    }

    /**
     * @ignore
     */
    public attachTo(contextType: string, artifact: Artifact) {
        this._contextType = contextType;
        this._artifact = artifact;

        const { keyType, valueType, maxAccessKeys } = parseCtxType(artifact, contextType);
        this.genericType = {
            keyType,
            valueType,
            maxAccessKeys,
        }
    }

    /**
     * @ignore
     * serialize the key to the byte string
     */
    public serializeKey(key: KeyType): ByteString {
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
    public serializeValue(value: ValueType): ByteString {
        this.assertAttached();
        return serializeState(this._artifact, this.genericType.valueType, value, false)
    }

    /**
     * @ignore
     * create an empty value, used for the fixed array empty values and the merkle tree
     */
    public emptyValue(): ValueType {
        this.assertAttached();
        return createEmptyState(this._artifact, this.genericType.valueType, false)
    }

    /**
     * @ignore
     * create an empty key, used for the fixed array empty values
     */
    public emptyKey(): KeyType {
        this.assertAttached();
        switch(typeof this.genericType.keyType) {
            case 'number':
            case 'bigint':
                return 0n as KeyType;
            case 'boolean':
                return false as KeyType;
            case 'string':
                return '' as KeyType;
            default:
                throw new Error(`Unsupported key type: ${typeof this.genericType.keyType}`);
        }
    }


    public assertAttached() {
        if (!this._contextType || !this._artifact) {
            throw new Error('HashedMap is not attached to a context');
        }
    }

    public cloned() {

    }

    // dummy fields for the compiler
    protected __hashed_map_dummy_key__: KeyType
    protected __hashed_map_dummy_value__: ValueType
    protected __hashed_map_dummy_max_access_keys__: MaxAccessKeys
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
