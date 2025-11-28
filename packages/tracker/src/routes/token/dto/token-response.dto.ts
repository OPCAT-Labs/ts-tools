import { ApiProperty } from '@nestjs/swagger';

export class BaseResponse<T> {
  @ApiProperty({ example: 0, description: 'Response code, 0 for success' })
  code: number;

  @ApiProperty({ example: 'OK', description: 'Response message' })
  msg: string;

  @ApiProperty({ description: 'Response data' })
  data: T;
}

export class TokenInfo {
  @ApiProperty({ example: '1234567890abcdef_0', description: 'Token ID' })
  tokenId: string;

  @ApiProperty({ example: '1234567890abcdef', description: 'Genesis transaction ID' })
  genesisTxid: string;

  @ApiProperty({ example: 'My Token', description: 'Token name' })
  name: string;

  @ApiProperty({ example: 'MTK', description: 'Token symbol' })
  symbol: string;

  @ApiProperty({ example: 8, description: 'Token decimals' })
  decimals: number;

  @ApiProperty({ example: true, description: 'Indicates if the token has admin capabilities' })
  hasAdmin: boolean;

  @ApiProperty({ example: 'abc123...', description: 'Minter script hash' })
  minterScriptHash: string;

  @ApiProperty({ example: 'def456...', description: 'Admin script hash' })
  adminScriptHash: string;

  @ApiProperty({ example: 'def456...', description: 'Token script hash' })
  tokenScriptHash: string;

  @ApiProperty({ example: 100000, description: 'First mint block height' })
  firstMintHeight: number;

  @ApiProperty({ example: 'abcdef0102', description: 'Token metadata in raw hex format' })
  info: string;

  @ApiProperty({ example: 1254, description: 'Deploy height' })
  deployHeight: number;

  @ApiProperty({ example: '45ee725c2c5993b3e4d308842d87e973bf1951f5f7a804b21e4dd964ecd12d6b', description: 'Deploy Txid' })
  deployTxid: string;

}

export class TokenInfoResponse extends BaseResponse<TokenInfo> {
  @ApiProperty({ type: TokenInfo })
  data: TokenInfo;
}

export class TokenUtxoState {
  @ApiProperty({ example: 'abc123......', description: 'The owner address, p2pkh script hex or locking script hash' })
  address: string
  @ApiProperty({ example: '100', description: 'Token amount' })
  amount: string;
}

export class TokenUtxo {
  @ApiProperty({ example: 'abc123...', description: 'Transaction ID' })
  txId: string;

  @ApiProperty({ example: 0, description: 'Output index' })
  outputIndex: number;

  @ApiProperty({ example: '456def...', description: 'Locking script hash' })
  script: string;

  @ApiProperty({ example: 10000, description: 'Satoshi amount' })
  satoshis: string;

  @ApiProperty({ example: 'abc123......', description: 'utxo.data' })
  data: string;

  @ApiProperty({ type: TokenUtxoState, description: 'Token UTXO state' })
  state: TokenUtxoState
}

export class TokenUtxosData {
  @ApiProperty({ type: [TokenUtxo], description: 'Token UTXOs' })
  utxos: TokenUtxo[];

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenUtxosResponse extends BaseResponse<TokenUtxosData> {
  @ApiProperty({ type: TokenUtxosData })
  data: TokenUtxosData;
}

export class TokenBalanceData {
  @ApiProperty({ example: '1234567890abcdef_0', description: 'Token ID' })
  tokenId: string;

  @ApiProperty({ example: '100', description: 'Confirmed balance' })
  confirmed: string;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenBalanceResponse extends BaseResponse<TokenBalanceData> {
  @ApiProperty({ type: TokenBalanceData })
  data: TokenBalanceData;
}

export class TokenTotalMintedAmountData {
  @ApiProperty({ example: '5000000000', description: 'Total mint amount' })
  totalMintedAmount: string;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenTotalMintedAmountResponse extends BaseResponse<TokenTotalMintedAmountData> {
  @ApiProperty({ type: TokenTotalMintedAmountData })
  data: TokenTotalMintedAmountData;
}

export class TotalHoldersData {
  @ApiProperty({ example: 12000, description: 'Total holders number' })
  totalHolders: number;
  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TotalHoldersResponse extends BaseResponse<TotalHoldersData> {
  @ApiProperty({ type: TotalHoldersData })
  data: TotalHoldersData;
}

export class TotalTxsData {
  @ApiProperty({ example: 21000000, description: 'Total transaction number' })
  totalTxs: number;
  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TotalTxsResponse extends BaseResponse<TotalTxsData> {
  @ApiProperty({ type: TotalTxsData })
  data: TotalTxsData;
}

export class TokenTotalSupplyData {
  @ApiProperty({ example: '4500000000', description: 'Current total supply amount' })
  totalSupply: string;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenTotalSupplyResponse extends BaseResponse<TokenTotalSupplyData> {
  @ApiProperty({ type: TokenTotalSupplyData })
  data: TokenTotalSupplyData;
}

export class TokenHolder {
  @ApiProperty({ example: 'moP2wuUKQ5aqXswdeGX4VoRjbbyd6bc123', description: 'p2pkh address or script hash' })
  address: string;

  @ApiProperty({ example: '100', description: 'Token balance' })
  balance: string;

  @ApiProperty({ example: 1, description: 'Token rank' })
  rank: number;

  @ApiProperty({ example: 0.05, description: 'Token percentage' })
  percentage: number;

}

export class TokenHoldersData {
  @ApiProperty({ type: [TokenHolder], description: 'Token holders' })
  holders: TokenHolder[];

  @ApiProperty({ example: 1000, description: 'Total number of token holders' })
  total: number;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenHoldersResponse extends BaseResponse<TokenHoldersData> {
  @ApiProperty({ type: TokenHoldersData })
  data: TokenHoldersData;
}

export class ErrorResponse extends BaseResponse<null> {
  @ApiProperty({ example: 100, description: 'Error code' })
  code: number;

  @ApiProperty({ example: 'Error message', description: 'Error description' })
  msg: string;

  @ApiProperty({ example: null, description: 'Always null for error responses' })
  data: null;
}
