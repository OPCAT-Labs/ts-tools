import { Injectable, Logger } from '@nestjs/common';
import { TxEntity } from '../../entities/tx.entity';
import { DataSource, EntityManager, MoreThanOrEqual, Repository } from 'typeorm';
import { payments, TxInput, crypto } from '@scrypt-inc/bitcoinjs-lib';
import { Transaction, encoding } from '@opcat-labs/opcat';
import { TxOutEntity } from '../../entities/txOut.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Constants } from '../../common/constants';
import { TokenInfoEntity } from '../../entities/tokenInfo.entity';
import { NftInfoEntity } from '../../entities/nftInfo.entity';
import { CatTxError, TransferTxError } from '../../common/exceptions';
import { bin2num, parseTokenInfoEnvelope } from '../../common/utils';
import { BlockHeader, EnvelopeMarker, TaprootPayment, TokenInfoEnvelope } from '../../common/types';
import { TokenMintEntity } from '../../entities/tokenMint.entity';
import { LRUCache } from 'lru-cache';
import { CommonService } from '../common/common.service';
import { TxOutArchiveEntity } from 'src/entities/txOutArchive.entity';
import { Cron } from '@nestjs/schedule';
import { sha256 } from 'scrypt-ts';
import { deserializeMetadata } from './deserializeMeta';

@Injectable()
export class TxService {
  private readonly logger = new Logger(TxService.name);

  private static readonly taprootPaymentCache = new LRUCache<string, { pubkey: Buffer; redeemScript: Buffer }>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private static readonly tokenInfoCache = new LRUCache<string, TokenInfoEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private dataSource: DataSource;

  constructor(
    private commonService: CommonService,
    @InjectRepository(TokenInfoEntity)
    private tokenInfoEntityRepository: Repository<TokenInfoEntity>,
    @InjectRepository(TxEntity)
    private txEntityRepository: Repository<TxEntity>,
    @InjectRepository(TxOutEntity)
    private txOutEntityRepository: Repository<TxOutEntity>,
    @InjectRepository(NftInfoEntity)
    private nftInfoEntityRepository: Repository<NftInfoEntity>,
    @InjectRepository(TokenMintEntity)
    private tokenMintEntityRepository: Repository<TokenMintEntity>,
  ) {
    this.dataSource = this.txEntityRepository.manager.connection;
  }

  /**
   * Process a transaction
   * @param tx transaction to save
   * @param txIndex index of this transaction in the block
   * @param blockHeader header of the block that contains this transaction
   * @returns processing time in milliseconds if successfully processing a CAT-related tx, otherwise undefined
   */
  async processTx(tx: Transaction, txIndex: number, blockHeader: BlockHeader) {
    if (tx.isCoinbase()) {
      return;
    }

    const startTs = Date.now();
    try {
      this.updateSpent(tx);

      // found Guard in inputs, this is a token transfer tx
      await this.processTransferTx(tx, txIndex, blockHeader);
      this.logger.log(`[OK] transfer tx ${tx.id}`);

      // // search minter in inputs
      await this.processMintTx(tx, txIndex, blockHeader);
      this.logger.log(`[OK] mint tx ${tx.id}`);

      return Math.ceil(Date.now() - startTs);
    } catch (e) {
      if (e instanceof TransferTxError) {
        this.logger.error(`[502750] invalid transfer tx ${tx.id}, ${e.message}`);
      } else {
        if (e instanceof CatTxError) {
          this.logger.log(`skip tx ${tx.id}, ${e.message}`);
        } else {
          this.logger.error(`process tx ${tx.id} error, ${e.message} ${e.stack}`);
        }
      }
    }
    // return Math.ceil(Date.now() - startTs);
  }

  private async updateSpent(tx: Transaction) {
    await Promise.all(
      tx.inputs.map((input, i) => {
        const prevTxid = input.prevTxId.toString('hex');
        const prevOutputIndex = input.outputIndex;
        return this.txOutEntityRepository.update(
          {
            txid: prevTxid,
            outputIndex: prevOutputIndex,
          },
          {
            spendTxid: tx.id,
            spendInputIndex: i,
          },
        );
      }),
    );
  }

  private async saveTx(tx: Transaction, txIndex: number, blockHeader: BlockHeader) {
    return this.txEntityRepository.save({
      txid: tx.id,
      blockHeight: blockHeader.height,
      txIndex,
    });
  }

  private async getTokenInfo(minterPubKey: string) {
    let tokenInfo = TxService.tokenInfoCache.get(minterPubKey);
    if (!tokenInfo) {
      tokenInfo = await this.tokenInfoEntityRepository.findOne({
        select: ['tokenId', 'genesisTxid', 'name', 'symbol', 'decimals', 'minterPubKey', 'tokenPubKey'],
        where: { minterPubKey },
      });
      if (tokenInfo && tokenInfo.tokenPubKey) {
        const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
        if (lastProcessedHeight !== null) {
          TxService.tokenInfoCache.set(minterPubKey, tokenInfo);
        }
      }
    }
    return tokenInfo;
  }

  private async processMintTx(tx: Transaction, txIndex: number, blockHeader: BlockHeader) {
    const promises: Promise<any>[] = [];
    for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
      const output = tx.outputs[outputIndex];
      const meta = deserializeMetadata(output.data);
      if (meta) {
        const tokenPubKey = sha256(output.script.toHex());
        promises.push(
          this.tokenMintEntityRepository.save({
            txid: tx.id,
            tokenPubKey: tokenPubKey,
            blockHeight: blockHeader.height,
          }),
        );
        promises.push(this.txOutEntityRepository.save({ ...this.buildBaseTxOutEntity(tx, outputIndex, blockHeader) }));
        // this.tokenInfoEntityRepository.save({
        //   tokenId,
        //   revealTxid: tx.getId(),
        //   revealHeight: blockHeader.height,
        //   genesisTxid,
        //   name: metadata['name'],
        //   symbol: metadata['symbol'],
        //   decimals: marker === EnvelopeMarker.Token ? metadata['decimals'] : -1,
        //   rawInfo: metadata,
        //   contentType: content?.type,
        //   contentEncoding: content?.encoding,
        //   contentRaw: content?.raw,
        //   minterPubKey,
        // }),
        // const exists = await this.tokenInfoEntityRepository.exists({ where: { tokenPubKey } });
        // if (!exists) {
        //   promises.push(this.tokenInfoEntityRepository.save({}));
        // }
      }
    }

    // // update token info when first mint
    // if (tokenInfo.tokenPubKey === null) {
    //   // tokenPubKey must not be shown before
    //   const exists = await this.tokenInfoEntityRepository.exists({ where: { tokenPubKey } });
    //   if (exists) {
    //     throw new CatTxError('invalid mint tx, first time mint but token pubkey already exists');
    //   }
    //   promises.push(
    //     this.tokenInfoEntityRepository.update(
    //       {
    //         tokenId: tokenInfo.tokenId,
    //       },
    //       {
    //         tokenPubKey,
    //         firstMintHeight: blockHeader.height,
    //       },
    //     ),
    //   );
    // }
    // // save token mint
    await Promise.all([...promises, this.saveTx(tx, txIndex, blockHeader)]);
  }

  private async processTransferTx(tx: Transaction, txIndex: number, blockHeader: BlockHeader) {
    const promises: Promise<any>[] = [];
    for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
      const output = tx.outputs[outputIndex];
      if (output.data.length === 29) {
        const br = new encoding.BufferReader(output.data);
        const amount = BigInt(br.readInt32LE());
        const ownerAddr = br.readAll().toString('hex');
        const p = this.txOutEntityRepository.save({
          ...this.buildBaseTxOutEntity(tx, outputIndex, blockHeader),
          ownerPubKeyHash: ownerAddr,
          tokenAmount: amount,
        });
        promises.push(p);
      }
    }
    await Promise.all([...promises, this.saveTx(tx, txIndex, blockHeader)]);
  }

  /**
   * Delete tx in blocks with height greater than or equal to the given height
   */
  public async deleteTx(manager: EntityManager, height: number) {
    // txs to delete
    const txs = await this.txEntityRepository.find({
      select: ['txid'],
      where: { blockHeight: MoreThanOrEqual(height) },
    });
    const promises = [
      manager.delete(NftInfoEntity, {
        mintHeight: MoreThanOrEqual(height),
      }),
      manager.update(
        TokenInfoEntity,
        { firstMintHeight: MoreThanOrEqual(height) },
        { firstMintHeight: null, tokenPubKey: null },
      ),
      manager.delete(TokenMintEntity, {
        blockHeight: MoreThanOrEqual(height),
      }),
      manager.delete(TxEntity, { blockHeight: MoreThanOrEqual(height) }),
      manager.delete(TxOutEntity, { blockHeight: MoreThanOrEqual(height) }),
      // reset spent status of tx outputs
      ...txs.map((tx) => {
        return manager.update(TxOutEntity, { spendTxid: tx.txid }, { spendTxid: null, spendInputIndex: null });
      }),
    ];
    if (txs.length > 0) {
      // Empty criteria(s) are not allowed for the delete method
      promises.push(
        manager.delete(
          TokenInfoEntity,
          txs.map((tx) => {
            return { genesisTxid: tx.txid };
          }),
        ),
      );
    }
    return Promise.all(promises);
  }

  private buildBaseTxOutEntity(tx: Transaction, outputIndex: number, blockHeader: BlockHeader) {
    return {
      txid: tx.id,
      outputIndex,
      blockHeight: blockHeader.height,
      satoshis: BigInt(tx.outputs[outputIndex].satoshis),
      lockingScriptHash: sha256(tx.outputs[outputIndex].script.toHex()),
    };
  }

  @Cron('* * * * *')
  private async archiveTxOuts() {
    const startTime = Date.now();
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    if (lastProcessedHeight === null) {
      return;
    }
    const txOuts = await this.dataSource.manager
      .createQueryBuilder('tx_out', 'txOut')
      .innerJoin('tx', 'tx', 'txOut.spend_txid = tx.txid')
      .where('txOut.spend_txid IS NOT NULL')
      .andWhere('tx.block_height < :blockHeight', {
        blockHeight: lastProcessedHeight - 2880, // blocks before one day ago
      })
      .limit(1000) // archive no more than 1000 records once a time
      .getMany();
    if (txOuts.length === 0) {
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      await Promise.all([
        manager.save(TxOutArchiveEntity, txOuts),
        manager.delete(
          TxOutEntity,
          txOuts.map((txOut) => {
            return { txid: txOut.txid, outputIndex: txOut.outputIndex };
          }),
        ),
      ]);
    });
    this.logger.log(`archived ${txOuts.length} outs in ${Math.ceil(Date.now() - startTime)} ms`);
  }
}
