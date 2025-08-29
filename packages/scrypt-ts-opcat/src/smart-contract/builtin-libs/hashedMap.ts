import { ByteString } from '../types';
import { SmartContractLib } from '../smartContractLib.js';
import { PrimitiveTypes, SupportedParamType } from '../types/primitives';

export class HashedMap<
    KeyType extends PrimitiveTypes,
    ValueType extends SupportedParamType,
    MaxAccessKeys extends number
> extends Map<KeyType, ValueType> {
    root: ByteString

    /**
     * Can call it inside a `@method` function
     * @param root - The root of the merkle tree
     */
    constructor(root: ByteString) {
        super(...arguments)
        this.root = root
    }

    /**
     * Can call it inside a `@method` function
     */
    public get(key: KeyType): ValueType {
        // implement js runtime
        return undefined as ValueType
    }

    /**
     * Can call it inside a `@method` function
     */
    public set(key: KeyType, value: ValueType): this {
        // implement js runtime
        return this
    }

    protected __hashed_map_dummy_key__: KeyType
    protected __hashed_map_dummy_value__: ValueType
    protected __hashed_map_dummy_max_access_keys__: MaxAccessKeys
}