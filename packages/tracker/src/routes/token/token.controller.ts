import { Controller, DefaultValuePipe, Get, Param, Query, Res, UseInterceptors } from '@nestjs/common';
import { TokenService } from './token.service';
import { okResponse, errorResponse } from '../../common/utils';
import { ApiOperation, ApiParam, ApiQuery, ApiTags, ApiOkResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { TokenTypeScope } from '../../common/types';
import { ResponseHeaderInterceptor } from '../../common/interceptors/response-header.interceptor';
import {
  TokenInfoResponse,
  TokenUtxosResponse,
  TokenBalanceResponse,
  TokenTotalMintedAmountResponse,
  TokenTotalSupplyResponse,
  TokenHoldersResponse,
  ErrorResponse,
  TotalHoldersResponse,
  TotalTxsResponse,
  TokenListResponse,
} from './dto/token-response.dto';
import { Response } from 'express';

@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) { }

  @Get()
  @ApiTags('token')
  @ApiOperation({ summary: 'Get tokens with pagination' })
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
    description: 'paging limit (max: 100, default: 50)',
  })
  @ApiOkResponse({
    description: 'Token list retrieved successfully',
    type: TokenListResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters',
    type: ErrorResponse,
  })
  async getTokens(
    @Query('offset') offset: number = 0,
    @Query('limit') limit: number = 50,
  ) {
    try {
      const result = await this.tokenService.searchTokens(
        undefined,
        TokenTypeScope.Fungible,
        offset,
        limit,
      );

      return okResponse({
        list: result.tokens,
        total: result.total,
        trackerBlockHeight: result.trackerBlockHeight,
      });
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get('/search')
  @ApiTags('token')
  @ApiOperation({ summary: 'Search tokens by token id or token name with pagination' })
  @ApiQuery({
    name: 'q',
    required: true,
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
    
    if (!query || !query.trim()) {
      return errorResponse(new Error('Search query cannot be empty'));
    }
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

  @Get(':tokenIdOrTokenScriptHash/icon')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token icon' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token script hash',
  })
  async getTokenIcon(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string, @Res() res: Response) {
    try {
      const content = await this.tokenService.getTokenIcon(tokenIdOrTokenScriptHash);
      if (content?.raw) {
        if (content?.type) {
          res.setHeader('Content-Type', content.type);
        }
        if (content?.encoding) {
          res.setHeader('Content-Encoding', content.encoding);
        }
        if (content?.lastModified) {
          res.setHeader('Last-Modified', content.lastModified.toUTCString());
        }
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(content.raw);
      } else {
        res.sendStatus(404);
      }
    } catch (e) {
      return res.send(errorResponse(e));
    }
  }

  @Get(':tokenIdOrTokenScriptHash/totalHolders')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token holders number by token id or token script hash' })
  @ApiOkResponse({
    description: 'Token holders number retrieved successfully',
    type: TotalHoldersResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token script hash',
    type: ErrorResponse,
  })
  async getTokenTotalHolders(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const r = await this.tokenService.getTokenTotalHolders(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
      );
      return okResponse(r);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/totalTxs')
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
    type: TotalTxsResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token script hash',
    type: ErrorResponse,
  })
  async getTokenTotalTxs(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const r = await this.tokenService.getTokenTotalTxsByTokenIdOrTokenScriptHash(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
      );
      return okResponse(r);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/txs')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token transactions by token id or token script hash with pagination' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token script hash',
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
  async getTokenTxs(
    @Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string,
    @Query('offset', new DefaultValuePipe(0)) offset: number,
    @Query('limit', new DefaultValuePipe(10)) limit: number,
  ) {
    try {
      const r = await this.tokenService.getTokenTxsByTokenIdOrTokenScriptHash(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
        offset,
        limit,
      );
      return okResponse(r);
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

  @Get(':tokenIdOrTokenScriptHash/totalMintedAmount')
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
    type: TokenTotalMintedAmountResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token address',
    type: ErrorResponse,
  })
  async getTokenTotalMintedAmount(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const mintCount = await this.tokenService.getTokenTotalMintedAmount(tokenIdOrTokenScriptHash, TokenTypeScope.Fungible);
      return okResponse(mintCount);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/totalSupply')
  @ApiTags('token')
  @ApiOperation({
    summary: 'Get token current total supply by token id or token address',
  })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token address',
  })
  @ApiOkResponse({
    description: 'Token total supply retrieved successfully',
    type: TokenTotalSupplyResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token address',
    type: ErrorResponse,
  })
  async getTokenTotalSupply(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const totalSupply = await this.tokenService.getTokenTotalSupply(
        tokenIdOrTokenScriptHash,
        TokenTypeScope.Fungible,
      );
      return okResponse(totalSupply);
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
      return okResponse(r);
    } catch (e) {
      return errorResponse(e);
    }
  }
}
