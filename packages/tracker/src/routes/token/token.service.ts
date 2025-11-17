import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TokenInfoEntity } from '../../entities/tokenInfo.entity';
import { IsNull, LessThanOrEqual, Repository, MoreThanOrEqual, LessThan, ILike } from 'typeorm';
import { ownerAddressToPubKeyHash } from '../../common/utils';
import { TxOutEntity } from '../../entities/txOut.entity';
import { Constants } from '../../common/constants';
import { LRUCache } from 'lru-cache';
import { TxEntity } from '../../entities/tx.entity';
import { CommonService } from '../../services/common/common.service';
import { CachedContent, TokenTypeScope } from '../../common/types';
import { TokenMintEntity } from '../../entities/tokenMint.entity';
import { HttpStatusCode } from 'axios';
import { MetadataSerializer } from '@opcat-labs/cat-sdk';

@Injectable()
export class TokenService {
  // tx stateHashes and txHashPreimage cache
  private static readonly txCache = new LRUCache<string, TxEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private static readonly tokenInfoCache = new LRUCache<string, TokenInfoEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private static readonly tokenIconCache = new LRUCache<string, CachedContent>({
    max: Constants.CACHE_MAX_SIZE,
  });

  

  constructor(
    private readonly commonService: CommonService,
    @InjectRepository(TokenInfoEntity)
    private readonly tokenInfoRepository: Repository<TokenInfoEntity>,
    @InjectRepository(TxOutEntity)
    private readonly txOutRepository: Repository<TxOutEntity>,
    @InjectRepository(TxEntity)
    private readonly txRepository: Repository<TxEntity>,
    @InjectRepository(TokenMintEntity)
    private readonly tokenMintRepository: Repository<TokenMintEntity>,
  ) { }

  async getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash: string, scope: TokenTypeScope) {
    let cached = TokenService.tokenInfoCache.get(tokenIdOrTokenScriptHash);
    if (!cached) {
      let where: object;
      if (tokenIdOrTokenScriptHash.includes('_')) {
        where = { tokenId: tokenIdOrTokenScriptHash };
      } else {
        where = { tokenScriptHash: tokenIdOrTokenScriptHash };
      }
      if (scope === TokenTypeScope.Fungible) {
        where = Object.assign(where, { decimals: MoreThanOrEqual(0) });
      } else if (scope === TokenTypeScope.NonFungible) {
        where = Object.assign(where, { decimals: LessThan(0) });
      }
      const tokenInfo = await this.tokenInfoRepository.findOne({
        select: [
          'tokenId',
          'genesisTxid',
          'name',
          'symbol',
          'decimals',
          'hasAdmin',
          'rawInfo',
          'minterScriptHash',
          'adminScriptHash',
          'tokenScriptHash',
          'firstMintHeight',
        ],
        where,
      });
      if (tokenInfo && tokenInfo.tokenScriptHash) {
        const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
        if (lastProcessedHeight !== null) {
          TokenService.tokenInfoCache.set(tokenIdOrTokenScriptHash, tokenInfo);
        }
      }
      cached = tokenInfo;
    } else {
      if (cached.decimals < 0 && scope === TokenTypeScope.Fungible) {
        cached = null;
      } else if (cached.decimals >= 0 && scope === TokenTypeScope.NonFungible) {
        cached = null;
      }
    }
    return this.renderTokenInfo(cached);
  }

  renderTokenInfo(tokenInfo: TokenInfoEntity) {
    if (!tokenInfo) {
      return null;
    }
    const rendered = Object.assign({}, { info: tokenInfo.rawInfo }, tokenInfo);
    delete rendered.rawInfo;
    return rendered;
  }

  async getTokenInfosByNamePrefix(tokenName: string, limit: number, scope: TokenTypeScope) {
    const results = [];
    if (scope !== TokenTypeScope.Fungible) {
      return
    }
    let where: object;
    where = {
      name: ILike(`${tokenName}%`),
    };

    const tokenInfos = await this.tokenInfoRepository.find({
      select: [
        'tokenId',
        'genesisTxid',
        'name',
        'symbol',
        'decimals',
        'hasAdmin',
        'rawInfo',
        'minterScriptHash',
        'adminScriptHash',
        'tokenScriptHash',
        'firstMintHeight',
      ],
      where,
      take: limit,
    });
    for (const tokenInfo of tokenInfos) {
      results.push(this.renderTokenInfo(tokenInfo));
    }

    return results;
  }

  async getTokenUtxosByOwnerAddress(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope,
    ownerAddrOrPkh: string,
    offset?: number,
    limit?: number,
  ) {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let utxos = [];
    if (tokenInfo) {
      utxos = await this.queryTokenUtxosByOwnerAddress(
        lastProcessedHeight,
        ownerAddrOrPkh,
        tokenInfo,
        offset || Constants.QUERY_PAGING_DEFAULT_OFFSET,
        Math.min(limit || Constants.QUERY_PAGING_DEFAULT_LIMIT, Constants.QUERY_PAGING_MAX_LIMIT),
      );
    }
    return {
      utxos: await this.renderUtxos(utxos, tokenInfo),
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  async getTokenAmountsByOwnerAddress(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope,
    ownerAddrOrPkh: string,
  ) {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let amounts: TxOutEntity[] = [];
    if (tokenInfo) {
      amounts = await this.queryTokenAmountsByOwnerAddress(lastProcessedHeight, ownerAddrOrPkh, tokenInfo);
    }
    return {
      trackerBlockHeight: lastProcessedHeight,
      amounts: amounts.map((amount) => amount.tokenAmount.toString()),
    }
  }

  async getTokenBalanceByOwnerAddress(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    ownerAddrOrPkh: string,
  ) {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    if (!tokenInfo) {
      throw new HttpException('Invalid tokenIdOrTokenAddr', HttpStatusCode.BadRequest);
    }
    const balances = await this.queryTokenBalancesByOwnerAddress(lastProcessedHeight, ownerAddrOrPkh, scope, tokenInfo);
    return {
      tokenId: tokenInfo.tokenId,
      confirmed: balances.length === 1 ? balances[0].confirmed.toString() : '0',
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  async queryTokenUtxosByOwnerAddress(
    lastProcessedHeight: number,
    ownerAddrOrPkh: string,
    tokenInfo: TokenInfoEntity | null = null,
    offset: number | null = null,
    limit: number | null = null,
  ) {
    const ownerPubKeyHash = ownerAddressToPubKeyHash(ownerAddrOrPkh);
    if (lastProcessedHeight === null || (tokenInfo && !tokenInfo.tokenScriptHash) || !ownerPubKeyHash) {
      return [];
    }
    const where = {
      ownerPubKeyHash,
      spendTxid: IsNull(),
    };
    if (tokenInfo) {
      Object.assign(where, { lockingScriptHash: tokenInfo.tokenScriptHash });
    }
    return this.txOutRepository.find({
      where,
      order: { tokenAmount: 'DESC' },
      skip: offset,
      take: limit,
    });
  }

  async queryTokenAmountsByOwnerAddress(
    lastProcessedHeight: number,
    ownerAddrOrPkh: string,
    tokenInfo: TokenInfoEntity,
  ) {
    const ownerPubKeyHash = ownerAddressToPubKeyHash(ownerAddrOrPkh);
    if (lastProcessedHeight === null || (tokenInfo && !tokenInfo.tokenScriptHash) || !ownerPubKeyHash) {
      return [];
    }
    const where = {
      ownerPubKeyHash,
      spendTxid: IsNull(),
      lockingScriptHash: tokenInfo.tokenScriptHash,
    };
    return this.txOutRepository.find({
      select: ['tokenAmount'],
      where,
    });
  }


  async queryTokenBalancesByOwnerAddress(
    lastProcessedHeight: number,
    ownerAddrOrPkh: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    tokenInfo: TokenInfoEntity | null = null,
  ) {
    const ownerPubKeyHash = ownerAddressToPubKeyHash(ownerAddrOrPkh);
    if (!ownerPubKeyHash) {
      throw new HttpException('Invalid ownerAddrOrPkh', HttpStatusCode.BadRequest);
    }
    if (lastProcessedHeight === null || (tokenInfo && !tokenInfo.tokenScriptHash) || !ownerPubKeyHash) {
      return [];
    }
    const query = this.txOutRepository
      .createQueryBuilder('t1')
      .select('t2.token_id', 'tokenId')
      .innerJoin(TokenInfoEntity, 't2', 't1.locking_script_hash = t2.token_script_hash')
      .where('t1.spend_txid IS NULL')
      .andWhere('t1.owner_pkh = :ownerPkh', { ownerPkh: ownerPubKeyHash })
      .groupBy('t2.token_id');
    if (scope === TokenTypeScope.Fungible) {
      query.addSelect('SUM(t1.token_amount)', 'confirmed').andWhere('t2.decimals >= 0');
    } else {
      query.addSelect('COUNT(1)', 'confirmed').andWhere('t2.decimals < 0');
    }
    if (tokenInfo) {
      query.andWhere('t1.locking_script_hash = :tokenPubKey', {
        tokenPubKey: tokenInfo.tokenScriptHash,
      });
    }
    const results = await query.getRawMany();
    return results.map((r) => ({
      tokenId: r.tokenId,
      confirmed: r.confirmed,
    }));
  }

  /**
   * render token utxos when passing tokenInfo, otherwise render minter utxos
   */
  async renderUtxos(utxos: TxOutEntity[], tokenInfo?: TokenInfoEntity) {
    const renderedUtxos = [];
    for (const utxo of utxos) {
      const renderedUtxo = {
        txId: utxo.txid,
        outputIndex: utxo.outputIndex,
        script: utxo.lockingScriptHash,
        satoshis: utxo.satoshis,
        data: utxo.data,
      };
      if (utxo.ownerPubKeyHash !== null && utxo.tokenAmount !== null) {
        Object.assign(
          renderedUtxo,
          tokenInfo && tokenInfo.decimals >= 0
            ? {
              state: {
                address: utxo.ownerPubKeyHash,
                amount: utxo.tokenAmount,
              },
            }
            : {
              state: {
                address: utxo.ownerPubKeyHash,
                localId: utxo.tokenAmount,
              },
            },
        );
      }
      renderedUtxos.push(renderedUtxo);
    }
    return renderedUtxos;
  }

  async getTokenMintAmount(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
  ): Promise<{
    amount: string;
    trackerBlockHeight: number;
  }> {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let amount = '0';
    if (tokenInfo && tokenInfo.tokenScriptHash && lastProcessedHeight) {
      const where = {
        tokenPubKey: tokenInfo.tokenScriptHash,
      };

      // todo: fix here token_amount is not exists at tokenMint.entity.ts
      if (scope === TokenTypeScope.Fungible) {
        const r = await this.tokenMintRepository
          .createQueryBuilder()
          .select('SUM(token_amount)', 'count')
          .where(where)
          .getRawOne();
        amount = r?.count || '0';
      } else {
        const r = await this.tokenMintRepository.count({ where });
        amount = (r || 0).toString();
      }
    }
    return {
      amount,
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  async getTokenCirculation(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
  ): Promise<{
    amount: string;
    trackerBlockHeight: number;
  }> {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let amount = '0';
    if (tokenInfo && tokenInfo.tokenScriptHash && lastProcessedHeight) {
      const where = {
        lockingScriptHash: tokenInfo.tokenScriptHash,
        spendTxid: IsNull(),
      };
      if (scope === TokenTypeScope.Fungible) {
        const r = await this.txOutRepository
          .createQueryBuilder()
          .select('SUM(token_amount)', 'count')
          .where(where)
          .getRawOne();
        amount = r?.count || '0';
      } else {
        const r = await this.txOutRepository.count({ where });
        amount = (r || 0).toString();
      }
    }
    return {
      amount,
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  async getTokenHolders(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    offset: number | null = null,
    limit: number | null = null,
  ): Promise<{
    holders: {
      ownerPubKeyHash: string;
      tokenAmount?: string;
      nftAmount?: number;
    }[];
    trackerBlockHeight: number;
  }> {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let holders = [];
    if (tokenInfo && tokenInfo.tokenScriptHash && lastProcessedHeight) {
      const query = this.txOutRepository
        .createQueryBuilder()
        .select('owner_pkh', 'ownerPubKeyHash')
        .where('spend_txid IS NULL')
        .andWhere('locking_script_hash = :xonlyPubkey', {
          xonlyPubkey: tokenInfo.tokenScriptHash,
        })
        .groupBy('owner_pkh')
        .limit(Math.min(limit || Constants.QUERY_PAGING_DEFAULT_LIMIT, Constants.QUERY_PAGING_MAX_LIMIT))
        .offset(offset || Constants.QUERY_PAGING_DEFAULT_OFFSET);
      if (scope === TokenTypeScope.Fungible) {
        query.addSelect('SUM(token_amount)', 'tokenAmount').orderBy('SUM(token_amount)', 'DESC');
      } else {
        query.addSelect('COUNT(1)', 'nftAmount').orderBy('COUNT(1)', 'DESC');
      }
      holders = await query.getRawMany();
    }
    return {
      holders,
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  private async _getTokenIcon(tokenIdOrScriptHash: string): Promise<CachedContent | null> {
    const tokenContent = await this.tokenInfoRepository.findOne({
      select: ['rawInfo', 'createdAt'],
      where: { tokenId: tokenIdOrScriptHash },
    });
    if (tokenContent) {
      try {
        const tokenInfo = MetadataSerializer.deserialize(tokenContent.rawInfo);
        if (tokenInfo.type !== 'Token') {
          return null;
        }
        if (!tokenInfo.info.metadata.icon) {
          return null;
        }
        const {type, body} = tokenInfo.info.metadata.icon;
        const contentType = MetadataSerializer.decodeContenType(type);
        const contentRaw = Buffer.from(body, 'hex');
        return {
          type: contentType,
          encoding: tokenInfo.info.contentEncoding,
          raw: contentRaw,
          lastModified: tokenContent.createdAt,
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async getTokenIcon(tokenIdOrScriptHash: string): Promise<CachedContent | null> {
    const key = `${tokenIdOrScriptHash}`;
    let cached = TokenService.tokenIconCache.get(key);
    if (!cached) {
      cached = await this._getTokenIcon(tokenIdOrScriptHash);
    }
    if (cached) {
      TokenService.tokenIconCache.set(key, cached);
    }
    return cached;
  }
}
