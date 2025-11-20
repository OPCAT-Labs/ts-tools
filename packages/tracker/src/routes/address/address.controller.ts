import { Controller, Get, Query, Param, UseInterceptors } from '@nestjs/common';
import { AddressService } from './address.service';
import { TxService } from '../tx/tx.service';
import { errorResponse, okResponse } from '../../common/utils';
import { ApiOperation, ApiParam, ApiQuery, ApiTags, ApiOkResponse, ApiBadRequestResponse, ApiHeader } from '@nestjs/swagger';
import { ResponseHeaderInterceptor } from '../../common/interceptors/response-header.interceptor';
import { TokenTypeScope } from '../../common/types';
import {
  TokenBalancesResponse,
  CollectionBalancesResponse,
  ErrorResponse,
  TransactionResponse
} from './dto/address-response.dto';

@Controller('addresses')
@UseInterceptors(ResponseHeaderInterceptor)
export class AddressController {

  constructor(
    private readonly addressService: AddressService,
    private readonly txService: TxService
  ) { }

  @Get(':ownerAddrOrPkh/balances')
  @ApiTags('address')
  @ApiOperation({ summary: 'Get token balances by owner address' })
  @ApiParam({
    name: 'ownerAddrOrPkh',
    required: true,
    type: String,
    description: 'token owner address or public key hash',
  })
  @ApiOkResponse({
    description: 'Token balances retrieved successfully',
    type: TokenBalancesResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid owner address or public key hash',
    type: ErrorResponse,
  })
  async getTokenBalances(@Param('ownerAddrOrPkh') ownerAddrOrPkh: string) {
    try {
      const balances = await this.addressService.getTokenBalances(ownerAddrOrPkh);
      return okResponse(balances);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':ownerAddrOrPkh/collections')
  @ApiTags('address')
  @ApiOperation({ summary: 'Get collection balances by owner address' })
  @ApiParam({
    name: 'ownerAddrOrPkh',
    required: true,
    type: String,
    description: 'collection owner address or public key hash',
  })
  @ApiOkResponse({
    description: 'Collection balances retrieved successfully',
    type: CollectionBalancesResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid owner address or public key hash',
    type: ErrorResponse,
  })
  async getCollectionBalances(@Param('ownerAddrOrPkh') ownerAddrOrPkh: string) {
    try {
      const balances = await this.addressService.getCollectionBalances(ownerAddrOrPkh);
      return okResponse({
        collections: balances.balances.map((balance) => {
          return {
            collectionId: balance.tokenId,
            confirmed: balance.confirmed,
            tokenScriptHash: balance.tokenScriptHash,
            name: balance.name,
            symbol: balance.symbol,
          };
        }),
        trackerBlockHeight: balances.trackerBlockHeight,
      });
    } catch (e) {
      return errorResponse(e);
    }
  }


  @Get(':ownerAddrOrPkh/tokenTxs')
  @ApiTags('address')
  @ApiOperation({
    summary: 'Get transactions by owner address or public key hash',
  })
  @ApiParam({
    name: 'ownerAddrOrPkh',
    required: true,
    type: String,
    description: 'owner address or public key hash',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'pagination offset',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'pagination limit',
  })
  @ApiOkResponse({
    description: 'Transactions retrieved successfully',
    type: TransactionResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token address',
    type: ErrorResponse,
  })
  async getTokenTransactions(
    @Param('ownerAddrOrPkh') ownerAddrOrPkh: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const finalOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
      const finalLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;

      const r = await this.txService.getTransactionsByAddress(
        ownerAddrOrPkh,
        TokenTypeScope.Fungible,
        finalOffset,
        finalLimit
      );
      return okResponse(r);
    } catch (e) {
      return errorResponse(e);
    }

  }

}
