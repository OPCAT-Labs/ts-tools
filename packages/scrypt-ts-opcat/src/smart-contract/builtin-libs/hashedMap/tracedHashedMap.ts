import { ByteString, FixedArray, PrimitiveTypes, StructObject } from "../../types/primitives.js"
import { HashedMap } from "./hashedMap.js"
import { cloneDeep } from '../../../utils/common.js';
import { assert, fill, intToByteString, toByteString } from "../../fns/index.js";
import { Hash160Merkle } from "./hash160Merkle.js";

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

/**
 * This class is a wrapper of the hashed map, only used to trace the access of the hashed map.
 * when executing the smart contract unlock method, wrap the hashed map and trace the access, then extract the hashed map contract and inject it to bitcoin unlocking script.
 */
export class TracedHashedMap<
    KeyType extends PrimitiveTypes, 
    ValueType extends StructObject, 
    MaxAccessKeys extends number
> {
    private beforeMap: HashedMap<KeyType, ValueType, MaxAccessKeys>;
    private afterMap: HashedMap<KeyType, ValueType, MaxAccessKeys>;
    private _tracer: AccessTracer<KeyType, ValueType>;

    constructor(
        beforeMap: HashedMap<KeyType, ValueType, MaxAccessKeys>,
    ) {
        this.beforeMap = beforeMap;
        this.afterMap = cloneDeep(beforeMap)
        this._tracer = new AccessTracer<KeyType, ValueType>();
        this._tracer.startTracing();
    }

    public set(key: KeyType, value: ValueType) {
        this._tracer.traceAccess(key);
        this.afterMap.set(key, value);
    }

    public get(key: KeyType): ValueType {
        this._tracer.traceAccess(key);
        return this.afterMap.get(key) as ValueType;
    }

    private serializeKey(key: KeyType): ByteString {
        return this.beforeMap.serializeKey(key);
    }
    private serializeValue(value: ValueType): ByteString {
        return this.beforeMap.serializeValue(value);
    }
    private emptyValue(): ValueType {
        return this.beforeMap.emptyValue();
    }
    private emptyKey(): KeyType {
        return this.beforeMap.emptyKey();
    }
    private get genericType(): {
        keyType: string,
        valueType: string,
        maxAccessKeys: number,
    } {
        return this.beforeMap.genericType;
    }

    /**
     * @ignore
     * used by the typeResolver to get the root of the merkle tree
     */
    private get _root() {
        return this.afterMap.getRoot();
    }

    extractContext(): {
        proofs: ByteString,
        keys: FixedArray<KeyType, MaxAccessKeys>,
        leafValues: FixedArray<ValueType, MaxAccessKeys>,
        nextLeafValues: FixedArray<ValueType, MaxAccessKeys>,
        accessIndexes: ByteString,
    } {
        this.afterMap.assertAttached();

        let proofs = toByteString('')
        
        const { accessKeys, accessIndexes: accessIndexesArray } = this._tracer.stopTracing();

        // 127 is the max length of the access indexes
        // here we use 1 byte to store the accessIndex
        // cause the max uint8 is 127, so the max access keys is 127
        assert(accessKeys.length <= 127, 'Access keys length exceeds 127');
        assert(accessKeys.length <= this.afterMap.genericType.maxAccessKeys, 'Access keys length exceeds max access keys');

        const keys = fill(this.emptyKey(), this.genericType.maxAccessKeys) as FixedArray<KeyType, MaxAccessKeys>;
        const leafValues = fill(this.emptyValue(), this.genericType.maxAccessKeys) as FixedArray<ValueType, MaxAccessKeys>;
        const nextLeafValues = fill(this.emptyValue(), this.genericType.maxAccessKeys) as FixedArray<ValueType, MaxAccessKeys>;

        const merkleTree = new Hash160Merkle(this.serializeValue(this.emptyValue()));
        // set the before values to the merkle tree
        merkleTree.setPairs(
            accessKeys.map(
                key => [
                    this.serializeKey(key),
                    this.serializeValue(this.beforeMap.get(key))
                ]
            )
        );

        for (let i = 0; i < accessKeys.length; i++) {
            const key = accessKeys[i];
            const leafValue = this.beforeMap.get(key) as ValueType;
            const nextLeafValue = this.afterMap.get(key) as ValueType;

            keys[i] = key;
            leafValues[i] = leafValue;
            nextLeafValues[i] = nextLeafValue;

            const proof = merkleTree.updateLeaf(this.serializeKey(key), this.serializeValue(leafValue));
            proofs += proof.join('');
        }
        const accessIndexes = accessIndexesArray.map(i => intToByteString(BigInt(i), 1n)).join('');

        return {
            proofs,
            keys,
            leafValues,
            nextLeafValues,
            accessIndexes,
        }
    }
}