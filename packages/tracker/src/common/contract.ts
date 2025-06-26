import { ByteString, byteString2Int, toByteString } from 'scrypt-ts';

export class ContractLib {
  // static readonly OPCAT_METADATA_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_METADATA_SUB_TAG
  // static readonly OPCAT_MINTER_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_MINTER_SUB_TAG
  // static readonly OPCAT_CAT20_TAG: ByteString = this.OPCAT_TAG + this.OPCAT_VERSION + this.OPCAT_CAT20_SUB_TAG
  static readonly OPCAT_METADATA_TAG: ByteString = toByteString('6f706361740100');
  static readonly OPCAT_MINTER_TAG: ByteString = toByteString('6f706361740101');
  static readonly OPCAT_CAT20_TAG: ByteString = toByteString('6f706361740102');
  static readonly OPCAT_UNKNOWN_TAG: ByteString = toByteString('');
  static readonly KNOW_TAGS = {
    '6f706361740100': true,
    '6f706361740101': true,
    '6f706361740102': true,
  };

  static decodeContractTag(data: Buffer) {
    const tagLen = Number(byteString2Int(data.subarray(0, 2).toString('hex')));
    const tag = data.subarray(2, 2 + tagLen).toString('hex');
    if (ContractLib.KNOW_TAGS[tag]) {
      return tag;
    } else {
      return '';
    }
  }
}
