import { ByteString } from "../../types/index.js";
import { UTXO } from "../../../globalTypes.js";
import {BufferReader, BufferWriter} from '../../../psbt/bufferutils.js'
import { hexToUint8Array, uint8ArrayToHex } from "../../../utils/index.js";
import fetch from 'cross-fetch';
import { SmartContract } from "../../smartContract.js";
import { HashedMapAbiUtil } from "./hashedMapAbiUtil.js";
import { HashedMap } from "./hashedMap.js";
import * as varuint from 'varuint-bitcoin';
import { len } from "../../fns/index.js";

type Outpoint = {
    txId: string
    outputIndex: number
}

export interface HashedMapProvider {
    /**
     * Get the key values snapshot of the hashed map instance
     * @param scripthash 
     * @param stateFieldPath 
     * @param utxo 
     * @returns 
     */
    getKeyValues(
        scripthash: string,
        stateFieldPath: string,
        utxo: Outpoint
    ): Promise<{
        keyValues: [ByteString, ByteString][],
    }>;

    /**
     * Get the latest utxo of the hashed map instance
     * @param scripthash 
     * @param stateFieldPath 
     * @param instanceOutpoint 
     * @returns 
     */
    getLatestUtxo(
        scripthash: string,
        stateFieldPath: string,
        instanceOutpoint: Outpoint
    ): Promise<Outpoint & {
        data: string
    }>;
}

export class HashedMapTrackerProvider implements HashedMapProvider {

    static bindUtxoCallback = bindUtxoCallback;

    constructor(
        private readonly trackerUrl: string,
    ) {}

    async getKeyValues(
        scripthash: string,
        stateFieldPath: string,
        currentOutpoint: Outpoint
    ): Promise<{
        keyValues: [ByteString, ByteString][],
    }> {
        return this._getKeyValues(scripthash, stateFieldPath, currentOutpoint);
    }

    async getLatestUtxo(
        scripthash: string,
        stateFieldPath: string,
        instanceOutpoint: Outpoint
    ): Promise<Outpoint & {
        data: string
        satoshis: number
    }> {
        const url = `${this.trackerUrl}/api/hashedmap/scripthash/${scripthash}/stateFieldPath/${encodeURIComponent(stateFieldPath)}/instanceOutpoint/${instanceOutpoint.txId}_${instanceOutpoint.outputIndex}/latestUtxo`
        const response = await fetch(url)
            .then(async res => {
                if (res.status !== 200) {
                    throw new Error(`status: ${res.status} msg: ${res.statusText}`);
                }
                return res.json();
            })
            .then(async data => {
                if (data.code === 0) {
                    return {
                        txId: data.data.txId,
                        outputIndex: data.data.outputIndex,
                        data: data.data.data,
                        satoshis: Number(data.data.satoshis),
                    };
                } else {
                    throw new Error(`code: ${data.code} msg: ${data.msg}`);
                }
            })
            .catch(async (err: Error) => {
                throw new Error(`invalid http response: ${err.message}`);
            });
        return response;
    }

    private async _getKeyValues(
        scripthash: string,
        stateFieldPath: string,
        currentOutpoint: Outpoint
    ): Promise<{
        keyValues: [ByteString, ByteString][],
    }> {
        const url = `${this.trackerUrl}/api/hashedmap/scripthash/${scripthash}/stateFieldPath/${encodeURIComponent(stateFieldPath)}/instances/outpoint/${currentOutpoint.txId}_${currentOutpoint.outputIndex}/keyValues.bin`
        const response = await fetch(url)
            .then(async res => {
                if (res.status !== 200) {
                    throw new Error(`status: ${res.status} msg: ${res.statusText}`);
                }
                if (res.headers.get('content-type').startsWith('application/octet-stream')) {
                    const bytes = await res.arrayBuffer();
                    const keyValues = HashedMapTrackerProvider.deserializeKeyValuesResponse(new Uint8Array(bytes));
                    return {
                        keyValues,
                    }
                } else {
                    const data = await res.json();
                    throw new Error(`code: ${data.code} msg: ${data.msg}`);
                }
            })
            .catch(async (err: Error) => {
                throw new Error(`invalid http response: ${err.message}`);
            });
        return response;
    }

    static serializeKeyValuesResponse(keyValues: [ByteString, ByteString][]) {
        let bytesLength = 0;
        bytesLength += varuint.encodingLength(keyValues.length);
        for (const [key, value] of keyValues) {
            bytesLength += varuint.encodingLength(len(key)) + Number(len(key));
            bytesLength += varuint.encodingLength(len(value)) + Number(len(value));
        }

        const bufWriter = new BufferWriter(new Uint8Array(bytesLength));
        bufWriter.writeVarInt(keyValues.length);
        for (const [key, value] of keyValues) {
            bufWriter.writeVarSlice(hexToUint8Array(key));
            bufWriter.writeVarSlice(hexToUint8Array(value));
        }
        return bufWriter.end();
    }

    static deserializeKeyValuesResponse(bytes: Uint8Array) {
        const bufReader = new BufferReader(bytes);
        const keyValues: [ByteString, ByteString][] = [];
        const len = bufReader.readVarInt();
        for (let i = 0; i < len; i++) {
            const key = bufReader.readVarSlice();
            const value = bufReader.readVarSlice();
            keyValues.push([uint8ArrayToHex(key), uint8ArrayToHex(value)]);
        }
       return keyValues
    }
}

function bindUtxoCallback(
    hashedmapProvider: HashedMapProvider,
) {
    return async (contract: SmartContract<any>) => {
        const artifact = (contract.constructor as typeof SmartContract<any>).artifact;
        if (!artifact.stateType) {
            return;
        }
        const utxo = contract.utxo;
        if (!utxo) {
            return;
        }
        const state = contract.state;
        const hashedMapFields = HashedMapAbiUtil.findHashedMapFieldsInStateType(artifact);
        for (const hashedMapField of hashedMapFields) {
            const fieldValue = HashedMapAbiUtil.getFieldValueByPath(state, hashedMapField);
            if (fieldValue instanceof HashedMap) {
                continue;
            }
            const ctxParam = HashedMapAbiUtil.getHashedMapCtxByState(artifact, hashedMapField);
            const {keyValues} = await hashedmapProvider.getKeyValues(contract.lockingScriptHash, hashedMapField, utxo);
            const hValue = new HashedMap<any, any, any>([]);
            hValue.attachTo(ctxParam.type, artifact);
            for (const [key, value] of keyValues) {
                hValue.set(hValue.deserializeKey(key), hValue.deserializeValue(value));
            }
            const root = hValue.getRoot();
            if (root !== fieldValue._root) {
                throw new Error(`Merkle tree root mismatch for hashed map field ${hashedMapField}`);
            }
            HashedMapAbiUtil.setFieldValueByPath(state, hashedMapField, hValue);
        }
        return;
    }
}