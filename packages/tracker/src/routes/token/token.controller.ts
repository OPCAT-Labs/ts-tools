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
  TokenMintAmountResponse,
  TokenCirculationResponse,
  TokenHoldersResponse,
  ErrorResponse,
} from './dto/token-response.dto';
import { ok } from 'assert';
import { IntegerType } from 'typeorm';
import { Response } from 'express';

@Controller('tokens')
@UseInterceptors(ResponseHeaderInterceptor)
export class TokenController {
  constructor(private readonly tokenService: TokenService) { }

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
      const holders = r.holders.map((holder) => {
        return {
          ownerPubKeyHash: holder.ownerPubKeyHash,
          balance: holder.tokenAmount!,
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
  @Get(':tokenName/getTokensByNamePrefix')
  @ApiTags('token')
  @ApiOperation({ summary: 'fuzzy search tokens by token names' })
  @ApiParam({
    name: 'tokenName',
    required: true,
    type: String,
    description: 'token name',
  })

  @ApiQuery({
    name: 'limit',
    required: false,
    schema: {type: 'number', default: 10, minimum: 1, maximum: 100},
    description: 'number limit',
  })
  @ApiOkResponse({
    description: 'Tokens retrieved successfully',
    type: [TokenInfoResponse],
  })
  @ApiBadRequestResponse({
    description: 'Invalid token name or limit',
    type: ErrorResponse,
  })
  async getTokensByName(@Param('tokenName') tokenName: string, @Query('limit', new DefaultValuePipe(10)) limit: number){
    // To be implemented
    try {
      const tokens = await this.tokenService.getTokenInfosByNamePrefix(tokenName, limit, TokenTypeScope.Fungible);
      return okResponse(tokens);
      
    } catch (e) {
      return errorResponse(e);
    }
  }
}
