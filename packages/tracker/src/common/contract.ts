import { Transaction } from '@opcat-labs/opcat';
import { ByteString, byteString2Int, toByteString } from 'scrypt-ts';
import { MetadataSerializer } from '@opcat-labs/cat-sdk';

export class ContractLib {
  // static readonly OPCAT_METADATA_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_METADATA_SUB_TAG
  // static readonly OPCAT_MINTER_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_MINTER_SUB_TAG
  // static readonly OPCAT_CAT20_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_CAT20_SUB_TAG
  // static readonly OPCAT_METADATA_TAG: ByteString = toByteString('6f706361740100');
  static readonly OPCAT_CAT20_MINTER_TAG: ByteString = toByteString('6f706361740101');
  static readonly OPCAT_CAT20_TAG: ByteString = toByteString('6f706361740102');
  // static readonly OPCAT_CAT721_METADATA_TAG: ByteString = toByteString('6f706361740103');
  static readonly OPCAT_CAT721_MINTER_TAG: ByteString = toByteString('6f706361740104');
  static readonly OPCAT_CAT721_TAG: ByteString = toByteString('6f706361740105');
  static readonly OPCAT_UNKNOWN_TAG: ByteString = toByteString('');
  static readonly KNOW_TAGS = {
    // '6f706361740100': true,
    '6f706361740101': true,
    '6f706361740102': true,
    '6f706361740104': true,
    '6f706361740105': true,
  };

  static decodeContractTag(data: Buffer): string {
    if (data.length < 2) {
      return ''
    }
    const tagLen = Number(byteString2Int(data.subarray(0, 2).toString('hex')));
    if (tagLen > data.length - 2) {
      return ''
    }
    const tag = data.subarray(2, 2 + tagLen).toString('hex');
    if (ContractLib.KNOW_TAGS[tag]) {
      return tag;
    } else {
      return '';
    }
  }

  static decodeOutputsTag(tx: Transaction): string[] {
    const tags = [];
    for (let index = 0; index < tx.outputs.length; index++) {
      const output = tx.outputs[index];
      tags.push(ContractLib.decodeContractTag(output.data));
    }
    return tags;
  }

  static decodeInputsTag(tx: Transaction): string[] {
    const tags = [];
    for (let index = 0; index < tx.inputs.length; index++) {
      const input = tx.inputs[index];
      if (input.output) {
        tags.push(ContractLib.decodeContractTag(input.output.data));
      } else {
        tags.push('');
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
      const dataLen = Number(byteString2Int(data.subarray(start, start + 2).toString('hex')));
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
