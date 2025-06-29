import { Controller, Get, Param, Query } from '@nestjs/common';
import { TokenService } from './token.service';
import { okResponse, errorResponse } from '../../common/utils';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TokenTypeScope } from '../../common/types';

@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Get(':tokenIdOrTokenScriptHash')
  @ApiTags('token')
  @ApiOperation({ summary: 'Get token info by token id or token script hash' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token script hash',
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
}
