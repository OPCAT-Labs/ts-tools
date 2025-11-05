import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { TokenService } from './token.service';
import { okResponse, errorResponse } from '../../common/utils';
import { ApiOperation, ApiParam, ApiQuery, ApiTags, ApiOkResponse, ApiBadRequestResponse, ApiHeader } from '@nestjs/swagger';
import { TokenTypeScope } from '../../common/types';
import { ResponseHeaderInterceptor } from '../../common/interceptors/response-header.interceptor';
import {
  TokenInfoResponse,
  TokenUtxosResponse,
  TokenBalanceResponse,
  TokenMintAmountResponse,
  TokenCirculationResponse,
  TokenHoldersResponse,
  ErrorResponse,
  HoldersNumResponse,
  SupplyResponse,
  TotalTransNumResponse,
} from './dto/token-response.dto';

@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) { }

  @Get('/search')
  @ApiTags('token')
  @ApiOperation({ summary: 'Search tokens by token id or token name with pagination' })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'search query (token id or token name), empty for all tokens',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'paging offset',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'paging limit',
  })
  @ApiOkResponse({
    description: 'Token list retrieved successfully',
    type: [TokenInfoResponse],
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters',
    type: ErrorResponse,
  })
  async searchTokens(
    @Query('q') query?: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    try {

      const result = await this.tokenService.searchTokens(
        query,
        TokenTypeScope.Fungible,
        offset,
        limit,
      );

      return okResponse(result);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token info by token id or token script hash' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token script hash',
  })
  @ApiOkResponse({
    description: 'Token information retrieved successfully',
    type: TokenInfoResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token script hash',
    type: ErrorResponse,
  })
  async getTokenInfo(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const tokenInfo = await this.tokenService.getTokenInfoByTokenIdOrTokenScriptHash(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
      );
      return okResponse(tokenInfo);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/holdersnum')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token holders number by token id or token script hash' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token script hash',
  })
  @ApiOkResponse({
    description: 'Token holders number retrieved successfully',
    type: HoldersNumResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token script hash',
    type: ErrorResponse,
  })
  async getTokenHoldersNum(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const holdersNum = await this.tokenService.getTokenHoldersNumByTokenIdOrTokenScriptHash(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
      );
      return okResponse(holdersNum);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/supply')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token supply by token id or token script hash' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token script hash',
  })
  @ApiOkResponse({
    description: 'Token supply retrieved successfully',
    type: SupplyResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token script hash',
    type: ErrorResponse,
  })
  async getTokenSupply(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const supply = await this.tokenService.getTokenSupplyByTokenIdOrTokenScriptHash(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
      );
      return okResponse(supply);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/totaltransnum')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token total transaction number by token id or token script hash' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token script hash',
  })
  @ApiOkResponse({
    description: 'Token total transaction number retrieved successfully',
    type: TotalTransNumResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token script hash',
    type: ErrorResponse,
  })
  async getTokenTotalTransNum(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const totalTransNum = await this.tokenService.getTokenTotalTransNumByTokenIdOrTokenScriptHash(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
      );
      return okResponse(totalTransNum);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/addresses/:ownerAddrOrPkh/utxos')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token utxos by owner address' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token script hash',
  })
  @ApiParam({
    name: 'ownerAddrOrPkh',
    required: true,
    type: String,
    description: 'token owner address or public key hash',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'paging offset',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'paging limit',
  })
  @ApiOkResponse({
    description: 'Token UTXOs retrieved successfully',
    type: TokenUtxosResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters',
    type: ErrorResponse,
  })
  async getTokenUtxosByOwnerAddress(
    @Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string,
    @Param('ownerAddrOrPkh') ownerAddrOrPkh: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const utxos = await this.tokenService.getTokenUtxosByOwnerAddress(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
        ownerAddrOrPkh,
        offset,
        limit,
      );
      return okResponse(utxos);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/addresses/:ownerAddrOrPkh/balance')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token balance by owner address' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token address',
  })
  @ApiParam({
    name: 'ownerAddrOrPkh',
    required: true,
    type: String,
    description: 'token owner address or public key hash',
  })
  @ApiOkResponse({
    description: 'Token balance retrieved successfully',
    type: TokenBalanceResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters',
    type: ErrorResponse,
  })
  async getTokenBalanceByOwnerAddress(
    @Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string,
    @Param('ownerAddrOrPkh') ownerAddrOrPkh: string,
  ) {
    try {
      const balance = await this.tokenService.getTokenBalanceByOwnerAddress(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
        ownerAddrOrPkh,
      );
      return okResponse(balance);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/mintAmount')
  @ApiTags('token')
  @ApiOperation({
    summary: 'Get token total mint amount by token id or token address',
  })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token address',
  })
  @ApiOkResponse({
    description: 'Token mint amount retrieved successfully',
    type: TokenMintAmountResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token address',
    type: ErrorResponse,
  })
  async getTokenMintAmount(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const mintCount = await this.tokenService.getTokenMintAmount(tokenIdOrTokenScriptHash, TokenTypeScope.Fungible);
      return okResponse(mintCount);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/circulation')
  @ApiTags('token')
  @ApiOperation({
    summary: 'Get token current circulation by token id or token address',
  })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token address',
  })
  @ApiOkResponse({
    description: 'Token circulation retrieved successfully',
    type: TokenCirculationResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token address',
    type: ErrorResponse,
  })
  async getTokenCirculation(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const circulation = await this.tokenService.getTokenCirculation(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
      );
      return okResponse(circulation);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/holders')
  @ApiTags('token')
  @ApiOperation({
    summary: 'Get token holders by token id or token address',
  })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token address',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'paging offset',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'paging limit',
  })
  @ApiOkResponse({
    description: 'Token holders retrieved successfully',
    type: TokenHoldersResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token address',
    type: ErrorResponse,
  })
  async getTokenHolders(
    @Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const r = await this.tokenService.getTokenHolders(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
        offset,
        limit,
      );
      const holders = r.holders.map((holder, index) => {
        return {
          ownerPubKeyHash: holder.ownerPubKeyHash,          
          balance: holder.tokenAmount!,
          rank: Number((offset || 0) + index + 1),
          percentage: holder.percentage
        };
      });

      return okResponse({
        holders,
        trackerBlockHeight: r.trackerBlockHeight,
      });
    } catch (e) {
      return errorResponse(e);
    }
  }

}
