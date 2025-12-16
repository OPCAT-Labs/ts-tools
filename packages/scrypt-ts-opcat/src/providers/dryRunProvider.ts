import { ChainProvider } from "./chainProvider.js";
import { cloneDeep, duplicateFilter, uint8ArrayToHex } from "../utils/common.js";
import { Script, Transaction } from "@opcat-labs/opcat";
import { ExtPsbt } from "../psbt/extPsbt.js";
import { UTXO } from "../globalTypes.js";
import { getUtxoKey, UtxoProvider } from "./utxoProvider.js";


export function createDryRunProvider<P extends ChainProvider & UtxoProvider>(
    provider: P
): P {
    const clonedProvider = cloneDeep(provider);
    const broadcastedTxs: Map<string, string> = new Map();
    const spentUTXOs = new Set<string>();
    const newUTXOs = new Map<string, UTXO>();

    function isUnSpent(txId: string, vout: number) {
        const key = getUtxoKey({ txId, outputIndex: vout, script: '', satoshis: 0, data: '' });
        return !spentUTXOs.has(key);
    }

    clonedProvider.broadcast = async (txHex: string): Promise<string> => {
        const tx = new Transaction(txHex);
        broadcastedTxs.set(tx.id, txHex);
        return tx.id;
    }
    clonedProvider.broadcastPsbt = async (psbtBase64: string, metadata?: Record<string, unknown>): Promise<string> => {
        const psbt = ExtPsbt.fromBase64(psbtBase64);
        const txHex = psbt.extractTransaction().toHex();
        return clonedProvider.broadcast(txHex);
    }
    clonedProvider.getRawTransaction = async (txId: string): Promise<string> => {
        let txHex = broadcastedTxs.get(txId);
        if (txHex) {
            return txHex;
        }
        return provider.getRawTransaction(txId);
    }
    clonedProvider.getUtxos = async (address: string): Promise<UTXO[]> => {
        const script = uint8ArrayToHex(Script.fromAddress(address).toBuffer());
        const utxos = await provider.getUtxos(address);
        return utxos
            .concat(Array.from(newUTXOs.values()))
            .filter((utxo) => isUnSpent(utxo.txId, utxo.outputIndex))
            .filter(duplicateFilter((utxo) => `${utxo.txId}:${utxo.outputIndex}`))
            .filter(utxo => utxo.script === script)
            .sort((a, b) => a.satoshis - b.satoshis);
    }
    clonedProvider.markSpent = (txId: string, vout: number): void => {
        const key = getUtxoKey({ txId, outputIndex: vout, script: '', satoshis: 0, data: '' });
        if (newUTXOs.has(key)) {
            newUTXOs.delete(key);
        }
        spentUTXOs.add(key);
    }
    clonedProvider.addNewUTXO = (utxo: UTXO): void => {
        newUTXOs.set(getUtxoKey(utxo), utxo);
    }
    return clonedProvider;
}

