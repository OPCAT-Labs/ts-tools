import { ApiProperty } from '@nestjs/swagger';

export class BaseResponse<T> {
  @ApiProperty({ example: 0, description: 'Response code, 0 for success' })
  code: number;

  @ApiProperty({ example: 'OK', description: 'Response message' })
  msg: string;

  @ApiProperty({ description: 'Response data' })
  data: T;
}

export class TokenBalance {
  @ApiProperty({ example: '1234567890abcdef_0', description: 'Token ID' })
  tokenId: string;

  @ApiProperty({ example: '100', description: 'Confirmed balance' })
  confirmed: string;

  @ApiProperty({ example: 'cat20', description: 'token name' })
  name: string;

  @ApiProperty({ example: 'cat20', description: 'token symbol' })
  symbol: string;

  @ApiProperty({ example: 'https://2312322.com/3221.png', description: 'token logoUrl' })
  logoUrl: string;

}

export class TokenBalancesData {
  @ApiProperty({ type: [TokenBalance], description: 'Token balances' })
  balances: TokenBalance[];

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenBalancesResponse extends BaseResponse<TokenBalancesData> {
  @ApiProperty({ type: TokenBalancesData })
  data: TokenBalancesData;
}

export class CollectionBalance {
  @ApiProperty({ example: '1234567890abcdef_0', description: 'Collection ID' })
  collectionId: string;

  @ApiProperty({ example: '5', description: 'Confirmed NFT count' })
  confirmed: string;

  @ApiProperty({ example: 'cat20', description: 'token name' })
  name: string;

  @ApiProperty({ example: 'cat20', description: 'token symbol' })
  symbol: string;

  @ApiProperty({ example: 'https://2312322.com/3221.png', description: 'token logoUrl' })
  logoUrl: string;
}

export class CollectionBalancesData {
  @ApiProperty({ type: [CollectionBalance], description: 'Collection balances' })
  collections: CollectionBalance[];

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class CollectionBalancesResponse extends BaseResponse<CollectionBalancesData> {
  @ApiProperty({ type: CollectionBalancesData })
  data: CollectionBalancesData;
}

export class TransactionData {
  @ApiProperty({ example: 'ade162290a77650375ccafe7afcad47bb81c4be4f169f77013ed106723f8b7ea', description: 'txid' })
  txid: string;
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
