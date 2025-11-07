import { Transaction } from '@opcat-labs/opcat';
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
}
