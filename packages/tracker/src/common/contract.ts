import { Script, Transaction } from '@opcat-labs/opcat';
import { ByteString, toByteString, byteStringToInt, ContractHeaderSerializer } from '@opcat-labs/scrypt-ts-opcat';
import { MetadataSerializer, CatTags } from '@opcat-labs/cat-sdk';

export class ContractLib {
  static decodeContractTags(lockingScript: string): string[] {
    try {
      const result = ContractHeaderSerializer.deserialize(lockingScript);
      if (result && typeof result === 'object' && result.header && Array.isArray(result.header.tags)) {
        return result.header.tags;
      }
    } catch (e) {
      // Failed to deserialize contract header, return empty tags
    }
    return [];
  }

  static decodeOutputsTag(tx: Transaction): string[][] {
    const tags: string[][] = [];
    for (let index = 0; index < tx.outputs.length; index++) {
      const output = tx.outputs[index];
      tags.push(ContractLib.decodeContractTags(output.script.toHex()));
    }
    return tags;
  }

  static decodeInputsTag(tx: Transaction): string[][] {
    const tags: string[][] = [];
    for (let index = 0; index < tx.inputs.length; index++) {
      const input = tx.inputs[index];
      if (input.output) {
        tags.push(ContractLib.decodeContractTags(input.output.script.toHex()));
      } else {
        tags.push([]);
      }
    }
    return tags;
  }

  static decodeTxTag(tx: Transaction) {
    return ContractLib.decodeInputsTag(tx).concat(ContractLib.decodeOutputsTag(tx));
  }

  static decodeFields(data: Buffer) {
    const fields = [];
    let start = 0;
    while (true) {
      const dataLen = Number(byteStringToInt(data.subarray(start, start + 2).toString('hex')));
      if (dataLen < 0) {
        break;
      }
      if (start + dataLen < data.length - 20) {
        start += 2;
        const field = data.subarray(start, start + dataLen).toString('hex');
        start += dataLen;
        fields.push(field);
      } else {
        break;
      }
    }
    fields.push(data.subarray(data.length - 20).toString('hex'));
    return fields;
  }

  static decodeAllOutputFields(tx: Transaction) {
    const outputFields: string[][] = [];
    for (const output of tx.outputs) {
      try {
        outputFields.push(ContractLib.decodeFields(output.data));
      } catch (e) {
        outputFields.push([])
      }
    }
    return outputFields;
  }

  static decodeAllOutputMetadata(tx: Transaction) {
    const metadatas: ReturnType<typeof MetadataSerializer.deserialize>[] = [];
    for (const output of tx.outputs) {
      try {
        const metadata = MetadataSerializer.deserialize(output.data.toString('hex'))
        if (metadata) {
          metadatas.push({
            type: metadata.type,
            info: metadata.info,
          });
        } else {
          metadatas.push(null);
        }
      } catch (e) {
        metadatas.push(null);
      }
    }
    return metadatas;
  }

  static decodeAllInputMetadata(tx: Transaction) {
    const inputMetadatas: ReturnType<typeof MetadataSerializer.deserialize>[] = [];
    for (const input of tx.inputs) {
      const metadata = MetadataSerializer.deserialize(input.output.data.toString('hex'))
      if (metadata) {
        inputMetadatas.push(metadata);
      } else {
        inputMetadatas.push(null);
      }
    }
    return inputMetadatas;
  }

  static isP2pkhUnlockingScript(script: Script): boolean {
    const chunks = script.chunks;
    return (
      chunks.length === 2 &&
      chunks[0].len >= 32 &&
      chunks[1].len >= 32
    );
  }

  static isP2pkhLockingScript(script: Script): boolean {
    const chunks = script.chunks;
    return (
      chunks.length === 5 &&
      chunks[0].opcodenum === 0x76 && // OP_DUP
      chunks[1].opcodenum === 0xa9 && // OP_HASH160
      chunks[2].len === 20 && // Push 20 bytes
      chunks[3].opcodenum === 0x88 && // OP_EQUALVERIFY
      chunks[4].opcodenum === 0xac // OP_CHECKSIG
    );
  }

  static txAllInputsAreP2pkh(tx: Transaction): boolean {
    // Check if any input has a non-P2PKH unlocking script, which may indicate a contract interaction
    // we roughly check the unlocking script pattern
    for (const input of tx.inputs) {
      const isP2pkh = ContractLib.isP2pkhUnlockingScript(input.script);
      if (!isP2pkh) {
        return false;
      }
    }
    return true;
  }

  static txAllOutputsAreP2pkh(tx: Transaction): boolean {
    // Check if any output has a non-P2PKH locking script, which may indicate a contract interaction
    for (const output of tx.outputs) {
      const script = output.script;
      const isP2pkh = ContractLib.isP2pkhLockingScript(script);
      if (!isP2pkh) {
        return false;
      }
    }
    return true;
  }
}