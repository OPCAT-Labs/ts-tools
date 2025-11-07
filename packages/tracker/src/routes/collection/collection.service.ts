import { Injectable } from '@nestjs/common';
import { CommonService } from '../../services/common/common.service';
import { TokenService } from '../token/token.service';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { TxOutEntity } from '../../entities/txOut.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { LRUCache } from 'lru-cache';
import { NftInfoEntity } from '../../entities/nftInfo.entity';
import { Constants } from '../../common/constants';
import { CachedContent, Content, TokenTypeScope } from '../../common/types';
import { TokenInfoEntity } from '../../entities/tokenInfo.entity';
import { TxService } from '../tx/tx.service';
import { MetadataSerializer } from '@opcat-labs/cat-sdk';
import { toHex } from '@opcat-labs/scrypt-ts-opcat';

@Injectable()
export class CollectionService {
  private static readonly nftInfoCache = new LRUCache<string, NftInfoEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private static readonly nftContentCache = new LRUCache<string, CachedContent>({
    max: Constants.CACHE_MAX_SIZE,
  });

  constructor(
    private readonly commonService: CommonService,
    private readonly tokenService: TokenService,
    private readonly txService: TxService,
    @InjectRepository(TxOutEntity)
    private readonly txOutRepository: Repository<TxOutEntity>,
    @InjectRepository(NftInfoEntity)
    private readonly nftInfoRepository: Repository<NftInfoEntity>,
    @InjectRepository(TokenInfoEntity)
    private readonly tokenInfoRepository: Repository<TokenInfoEntity>,
  ) { }

  private async _getCollectionContent(collectionIdOrScriptHash: string): Promise<CachedContent | null> {
    const collectionContent = await this.tokenInfoRepository.findOne({
      select: ['rawInfo', 'createdAt'],
      where: { tokenId: collectionIdOrScriptHash },
    });
    let ret: CachedContent | null = null;
    if (collectionContent) {
      try {
        const nftInfo = MetadataSerializer.deserialize(collectionContent.rawInfo);
        if (nftInfo.type !== 'Collection') {
          ret = null;
        } else {
          const isDelegate = nftInfo.info.delegate?.length > 0 && !nftInfo.info.contentBody;
          const contentType = isDelegate ? Constants.CONTENT_TYPE_CAT721_DELEGATE_V1 : MetadataSerializer.decodeContenType(nftInfo.info.contentType);
          const contentRaw = isDelegate ? Buffer.from(nftInfo.info.delegate, 'hex') : Buffer.from(nftInfo.info.contentBody, 'hex');
          ret = {
            type: contentType,
            encoding: nftInfo.info.contentEncoding,
            raw: contentRaw,
            lastModified: collectionContent.createdAt,
          };
        }
      } catch (e) {
        ret = null;
      }

      if (this.isDelegateContent(ret) && ret) {
        ret = await this.txService.getDelegateContent(toHex(ret.raw));
      }
    }
    return ret;
  }

  async getCollectionContent(collectionIdOrSriptHash: string): Promise<CachedContent | null> {
    const key = `${collectionIdOrSriptHash}`;
    let cached = CollectionService.nftContentCache.get(key);
    if (!cached) {
      cached = await this._getCollectionContent(collectionIdOrSriptHash);
    }
    if (cached) {
      CollectionService.nftContentCache.set(key, cached)
    }
    return cached
  }

  async getNftInfo(collectionIdOrScriptHash: string, localId: bigint) {
    const key = `${collectionIdOrScriptHash}_${localId}`;
    let cached = CollectionService.nftInfoCache.get(key);
    if (!cached) {
      const collectionInfo = await this.tokenService.getTokenInfoByTokenIdOrTokenScriptHash(
        collectionIdOrScriptHash,
        TokenTypeScope.NonFungible,
      );
      if (collectionInfo) {
        const nftInfo = await this.nftInfoRepository.findOne({
          select: ['collectionId', 'localId', 'mintTxid', 'mintHeight', 'commitTxid', 'metadata'],
          where: { collectionId: collectionInfo.tokenId, localId },
        });
        if (nftInfo) {
          const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
          if (
            lastProcessedHeight !== null &&
            lastProcessedHeight - nftInfo.mintHeight >= Constants.CACHE_AFTER_N_BLOCKS
          ) {
            CollectionService.nftInfoCache.set(key, nftInfo);
          }
        }
        cached = nftInfo;
      }
    }
    return cached;
  }

  private async _getNftContent(collectionIdOrScriptHash: string, localId: bigint): Promise<CachedContent | null> {
    const collectionInfo = await this.tokenService.getTokenInfoByTokenIdOrTokenScriptHash(
      collectionIdOrScriptHash,
      TokenTypeScope.NonFungible,
    );
    let ret: CachedContent | null = null;
    if (collectionInfo) {
      const nftContent = await this.nftInfoRepository.findOne({
        select: ['mintHeight', 'contentType', 'contentEncoding', 'contentRaw', 'createdAt'],
        where: { collectionId: collectionInfo.tokenId, localId },
      });
      if (nftContent) {
        ret = {
          type: nftContent.contentType,
          encoding: nftContent.contentEncoding,
          raw: nftContent.contentRaw,
          lastModified: nftContent.createdAt,
        };
        if (this.isDelegateContent(ret)) {
          // parse delegate content, no need to cache here
          ret = await this.txService.getDelegateContent(toHex(ret.raw));
        }
      }
    }
    return ret;
  }

  async getNftContent(collectionIdOrScriptHash: string, localId: bigint): Promise<CachedContent | null> {
    const key = `${collectionIdOrScriptHash}_${localId}`;
    let cached = CollectionService.nftContentCache.get(key);
    if (!cached) {
      cached = await this._getNftContent(collectionIdOrScriptHash, localId);
    }
    if (cached) {
      CollectionService.nftContentCache.set(key, cached);
    }
    return cached;
  }

  async getNftUtxo(collectionIdOrScriptHash: string, localId: bigint) {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const collectionInfo = await this.tokenService.getTokenInfoByTokenIdOrTokenScriptHash(
      collectionIdOrScriptHash,
      TokenTypeScope.NonFungible,
    );
    let utxos = [];
    if (collectionInfo && collectionInfo.tokenScriptHash) {
      const where = {
        lockingScriptHash: collectionInfo.tokenScriptHash,
        tokenAmount: localId,
        spendTxid: IsNull(),
        blockHeight: LessThanOrEqual(lastProcessedHeight),
      };
      utxos = await this.txOutRepository.find({
        where,
        take: 1,
      });
    }
    const renderedUtxos = await this.tokenService.renderUtxos(utxos, collectionInfo);
    const utxo = renderedUtxos.length > 0 ? renderedUtxos[0] : null;
    return {
      utxo,
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  isDelegateContent(content: CachedContent | null): boolean {
    return content?.type === Constants.CONTENT_TYPE_CAT721_DELEGATE_V1;
  }
}
