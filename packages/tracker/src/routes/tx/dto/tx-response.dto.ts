import { ApiProperty } from '@nestjs/swagger';

export class BaseResponse<T> {
  @ApiProperty({ example: 0, description: 'Response code, 0 for success' })
  code: number;

  @ApiProperty({ example: 'OK', description: 'Response message' })
  msg: string;

  @ApiProperty({ description: 'Response data' })
  data: T;
}

export class TokenOutput {
  @ApiProperty({ example: 0, description: 'Output index' })
  outputIndex: number;

  @ApiProperty({ example: 'abc123......', description: 'Owner public key hash' })
  ownerPubKeyHash: string;

  @ApiProperty({ example: '100', description: 'Token amount for fungible tokens', required: false })
  tokenAmount?: string;

  @ApiProperty({ example: '1234567890abcdef_0', description: 'Token ID for fungible tokens', required: false })
  tokenId?: string;

  @ApiProperty({ example: '1', description: 'Local ID for NFTs', required: false })
  localId?: string;

  @ApiProperty({ example: '1234567890abcdef_0', description: 'Collection ID for NFTs', required: false })
  collectionId?: string;
}

export class TxTokenOutputsData {
  @ApiProperty({ type: [TokenOutput], description: 'Token outputs from the transaction' })
  outputs: TokenOutput[];
}

export class TxTokenOutputsResponse extends BaseResponse<TxTokenOutputsData> {
  @ApiProperty({ type: TxTokenOutputsData })
  data: TxTokenOutputsData;
}

export class TransactionFromData {

  @ApiProperty({ example: '47917edcd52c791c5d359616d0ea301426b5da023a366b3b5fbc9e54cf9923ea', description: 'address' })
  address: string;

  @ApiProperty({ example: 100000, description: 'satoshis' })
  satoshis: number;

  @ApiProperty({ example: 'http://www.example.com/logo.png', description: 'Token Logo' })
  tokenLogo: string;

  @ApiProperty({ example: 'cat20', description: 'Token Name' })
  tokenName: string;

  @ApiProperty({ example: 'cat20', description: 'Token Symbol' })
  tokenSymbol: string;

  @ApiProperty({ example: '229194', description: 'Token Amount' })
  tokenAmount: number;

}


export class TransactionToData {

  @ApiProperty({ example: '47917edcd52c791c5d359616d0ea301426b5da023a366b3b5fbc9e54cf9923ea', description: 'address' })
  address: string;

  @ApiProperty({ example: 100000, description: 'satoshis' })
  satoshis: number;

  @ApiProperty({ example: 'http://www.example.com/logo.png', description: 'Token Logo' })
  tokenLogo: string;

  @ApiProperty({ example: 'cat20', description: 'Token Name' })
  tokenName: string;

  @ApiProperty({ example: 'cat20', description: 'Token Symbol' })
  tokenSymbol: string;

  @ApiProperty({ example: '229194', description: 'Token Amount' })
  tokenAmount: number;


}

export class TransactionData {

  @ApiProperty({ example: 'ade162290a77650375ccafe7afcad47bb81c4be4f169f77013ed106723f8b7ea', description: 'txid' })
  txid: string;

  @ApiProperty({ type: [TransactionFromData], description: 'transaction from data' })
  txFrom: TransactionFromData[];

  @ApiProperty({ type: [TransactionToData], description: 'transaction to data' })
  txTo: TransactionToData[];

}

export class TransactionResponse extends BaseResponse<TransactionData[]> {
  @ApiProperty({ type: [TransactionData] })
  data: TransactionData[];
}

export class ErrorResponse extends BaseResponse<null> {
  @ApiProperty({ example: 100, description: 'Error code' })
  code: number;

  @ApiProperty({ example: 'Error message', description: 'Error description' })
  msg: string;

  @ApiProperty({ example: null, description: 'Always null for error responses' })
  data: null;
}
