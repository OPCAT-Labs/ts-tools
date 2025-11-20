import { Controller, Get, Head, Param, Query, Res } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { okResponse, errorResponse } from '../../common/utils';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TokenService } from '../token/token.service';
import { Response } from 'express';
import { TokenTypeScope } from '../../common/types';
import { ErrorResponse } from '../token/dto/token-response.dto';
import { CollectionInfoResponse, NftInfoResponse, CollectionUtxosResponse, NftUtxoResponse, CollectionBalanceResponse, CollectionMintAmountResponse, NftHolderResponse, CollectionNftLocalIdsResponse, CollectionTotalSupplyResponse } from './dto/collection-response.dto';

@Controller('collections')
export class CollectionController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly tokenService: TokenService,
  ) {}

  @Get(':collectionIdOrAddr')
  @ApiTags('collection')
  @ApiOperation({
    summary: 'Get collection info by collection id or collection address',
  })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiOkResponse({
    description: 'Collection info retrieved successfully',
    type: CollectionInfoResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address',
    type: ErrorResponse,
  })
  async getCollectionInfo(@Param('collectionIdOrAddr') collectionIdOrAddr: string) {
    try {
      const collectionInfo = await this.tokenService.getTokenInfoByTokenIdOrTokenScriptHash(
        collectionIdOrAddr,
        TokenTypeScope.NonFungible,
      );
      if (collectionInfo) {
        Object.assign(collectionInfo, {
          collectionId: collectionInfo.tokenId,
          collectionScriptHash: collectionInfo.tokenScriptHash,
          metadata: collectionInfo.info,
        });
        delete collectionInfo.tokenId;
        delete collectionInfo.tokenScriptHash;
        delete collectionInfo.info;
        delete collectionInfo.decimals;
      }
      return okResponse(collectionInfo);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':collectionIdOrAddr/content')
  @ApiTags('collection')
  @ApiOperation({ summary: 'Get collection content' })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  async getCollectionContent(@Param('collectionIdOrAddr') collectionIdOrAddr: string, @Res() res: Response) {
    try {
      const content = await this.collectionService.getCollectionContent(collectionIdOrAddr);
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

  @Get(':collectionIdOrAddr/localId/:localId/content')
  @ApiTags('collection')
  @ApiOperation({ summary: 'Get nft content' })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiParam({
    name: 'localId',
    required: true,
    type: Number,
    description: 'nft local id',
  })
  async getNftContent(
    @Param('collectionIdOrAddr') collectionIdOrAddr: string,
    @Param('localId') localId: bigint,
    @Res() res: Response,
  ) {
    try {
      const content = await this.collectionService.getNftContent(collectionIdOrAddr, localId);
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

  @Get(':collectionIdOrAddr/localId/:localId')
  @ApiTags('collection')
  @ApiOperation({ summary: 'Get nft info' })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiParam({
    name: 'localId',
    required: true,
    type: Number,
    description: 'nft local id',
  })
  @ApiOkResponse({
    description: 'NFT info retrieved successfully',
    type: NftInfoResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address or nft local id',
    type: ErrorResponse,
  })
  async getNftInfo(@Param('collectionIdOrAddr') collectionIdOrAddr: string, @Param('localId') localId: bigint) {
    try {
      const nftInfo = await this.collectionService.getNftInfo(collectionIdOrAddr, localId);
      return okResponse(nftInfo);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':collectionIdOrAddr/localId/:localId/utxo')
  @ApiTags('collection')
  @ApiOperation({ summary: 'Get nft utxo' })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiParam({
    name: 'localId',
    required: true,
    type: Number,
    description: 'nft local id',
  })
  @ApiOkResponse({
    description: 'NFT UTXO retrieved successfully',
    type: NftUtxoResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address or nft local id',
    type: ErrorResponse,
  })
  async getNftUtxo(@Param('collectionIdOrAddr') collectionIdOrAddr: string, @Param('localId') localId: bigint) {
    try {
      const utxo = await this.collectionService.getNftUtxo(collectionIdOrAddr, localId);
      return okResponse(utxo);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':collectionIdOrAddr/addresses/:ownerAddrOrPkh/utxos')
  @ApiTags('collection')
  @ApiOperation({ summary: 'Get collection utxos by owner address' })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiParam({
    name: 'ownerAddrOrPkh',
    required: true,
    type: String,
    description: 'collection owner address or public key hash',
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
    description: 'Collection UTXOs retrieved successfully',
    type: CollectionUtxosResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address or collection owner address or public key hash',
    type: ErrorResponse,
  })
  async getCollectionUtxosByOwnerAddress(
    @Param('collectionIdOrAddr') collectionIdOrAddr: string,
    @Param('ownerAddrOrPkh') ownerAddrOrPkh: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const utxos = await this.tokenService.getTokenUtxosByOwnerAddress(
        collectionIdOrAddr,
        TokenTypeScope.NonFungible,
        ownerAddrOrPkh,
        offset,
        limit,
      );
      return okResponse(utxos);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':collectionIdOrAddr/addresses/:ownerAddrOrPkh/localIds')
  @ApiTags('collection')
  @ApiOperation({ summary: 'Get collection nft local ids by owner address' })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiParam({
    name: 'ownerAddrOrPkh',
    required: true,
    type: String,
    description: 'collection owner address or public key hash',
  })
  @ApiOkResponse({
    description: 'Collection NFT local IDs retrieved successfully',
    type: CollectionNftLocalIdsResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address or collection owner address or public key hash',
    type: ErrorResponse,
  })
  async getCollectionNftLocalIdsByOwnerAddress(
    @Param('collectionIdOrAddr') collectionIdOrAddr: string,
    @Param('ownerAddrOrPkh') ownerAddrOrPkh: string,
  ) { 
    try {
      const localIds = await this.tokenService.getTokenAmountsByOwnerAddress(
        collectionIdOrAddr,
        TokenTypeScope.NonFungible,
        ownerAddrOrPkh,
      );
      return okResponse({
        localIds: localIds.amounts,
        trackerBlockHeight: localIds.trackerBlockHeight,
      });
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':collectionIdOrAddr/addresses/:ownerAddrOrPkh/nftAmount')
  @ApiTags('collection')
  @ApiOperation({ summary: 'Get collection nft amount by owner address' })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiParam({
    name: 'ownerAddrOrPkh',
    required: true,
    type: String,
    description: 'collection owner address or public key hash',
  })
  @ApiOkResponse({
    description: 'Collection NFT balance retrieved successfully',
    type: CollectionBalanceResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address or collection owner address or public key hash',
    type: ErrorResponse,
  })
  async getCollectionBalanceByOwnerAddress(
    @Param('collectionIdOrAddr') collectionIdOrAddr: string,
    @Param('ownerAddrOrPkh') ownerAddrOrPkh: string,
  ) {
    try {
      const balance = await this.tokenService.getTokenBalanceByOwnerAddress(
        collectionIdOrAddr,
        TokenTypeScope.NonFungible,
        ownerAddrOrPkh,
      );
      return okResponse(
        balance && {
          collectionId: balance.tokenId,
          confirmed: balance.confirmed,
          trackerBlockHeight: balance.trackerBlockHeight,
        },
      );
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':collectionIdOrAddr/mintAmount')
  @ApiTags('collection')
  @ApiOperation({
    summary: 'Get collection total mint amount by collection id or collection address',
  })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiOkResponse({
    description: 'Collection mint amount retrieved successfully',
    type: CollectionMintAmountResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address',
    type: ErrorResponse,
  })
  async getCollectionMintAmount(@Param('collectionIdOrAddr') collectionIdOrAddr: string) {
    try {
      const mintCount = await this.tokenService.getTokenTotalMintedAmount(collectionIdOrAddr, TokenTypeScope.NonFungible);
      return okResponse(mintCount);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':collectionIdOrAddr/totalSupply')
  @ApiTags('collection')
  @ApiOperation({
    summary: 'Get collection current total supply by collection id or collection address',
  })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
  })
  @ApiOkResponse({
    description: 'Collection total supply retrieved successfully',
    type: CollectionTotalSupplyResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address',
    type: ErrorResponse,
  })
  async getCollectionTotalSupply(@Param('collectionIdOrAddr') collectionIdOrAddr: string) {
    try {
      const totalSupply = await this.tokenService.getTokenTotalSupply(collectionIdOrAddr, TokenTypeScope.NonFungible);
      return okResponse(totalSupply);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':collectionIdOrAddr/holders')
  @ApiTags('collection')
  @ApiOperation({
    summary: 'Get collection holders by collection id or collection address',
  })
  @ApiParam({
    name: 'collectionIdOrAddr',
    required: true,
    type: String,
    description: 'collection id or collection address',
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
    description: 'Collection holders retrieved successfully',
    type: NftHolderResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid collection id or collection address',
    type: ErrorResponse,
  })
  async getCollectionHolders(
    @Param('collectionIdOrAddr') collectionIdOrAddr: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const r = await this.tokenService.getTokenHolders(collectionIdOrAddr, TokenTypeScope.NonFungible, offset, limit);
      return okResponse(r);
    } catch (e) {
      return errorResponse(e);
    }
  }
}
