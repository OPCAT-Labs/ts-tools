import { Injectable, Logger } from '@nestjs/common';
import { TokenService } from '../token/token.service';
import { TxInput, payments, Transaction, script } from 'bitcoinjs-lib';
import { CachedContent, TaprootPayment, TokenTypeScope } from '../../common/types';
import { CommonService } from '../../services/common/common.service';
import { Constants } from '../../common/constants';
import { parseEnvelope } from '../../common/utils';
import { LRUCache } from 'lru-cache';
import { Transaction as OpcatTransaction } from '@opcat-labs/opcat';
import { toHex } from '@opcat-labs/scrypt-ts-opcat';
import { MetadataSerializer } from '@opcat-labs/cat-sdk';

@Injectable()
export class TxService {
  private readonly logger = new Logger(TxService.name);

  private static readonly contentCache = new LRUCache<string, CachedContent>({
    max: Constants.CACHE_MAX_SIZE,
  });

  constructor(
    private readonly commonService: CommonService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * todo: fix it to opcat layer tx parsing
   * @param txid 
   * @returns 
   */
  async parseTransferTxTokenOutputs(txid: string) {
    const raw = await this.commonService.getRawTx(txid);
    const tx = Transaction.fromHex(raw);
    const payIns = tx.ins.map((input) => this.parseTaprootInput(input));
    const payOuts = tx.outs.map((output) => this.commonService.parseTaprootOutput(output));
    const guardInputs = this.commonService.searchGuardInputs(payIns);
    if (guardInputs.length === 0) {
      throw new Error('not a token transfer tx');
    }
    const outputs = [];
    for (const guardInput of guardInputs) {
      const tokenOutputs = this.commonService.parseTransferTxTokenOutputs(guardInput);
      if (tokenOutputs.size > 0) {
        const isFungible = this.commonService.isFungibleGuard(guardInput);
        outputs.push(
          ...(await Promise.all(
            [...tokenOutputs.keys()].map(async (i) => {
              const tokenInfo = await this.tokenService.getTokenInfoByTokenPubKey(
                payOuts[i].pubkey.toString('hex'),
                isFungible ? TokenTypeScope.Fungible : TokenTypeScope.NonFungible,
              );
              const tokenOutput = tokenOutputs.get(i);
              return Object.assign(
                {},
                {
                  outputIndex: i,
                  ownerPubKeyHash: tokenOutput.ownerPubKeyHash,
                },
                isFungible
                  ? {
                      tokenAmount: tokenOutput.tokenAmount.toString(),
                      tokenId: tokenInfo.tokenId,
                    }
                  : {
                      localId: tokenOutput.tokenAmount.toString(),
                      collectionId: tokenInfo.tokenId,
                    },
              );
            }),
          )),
        );
      }
    }
    return { outputs };
  }

  /**
   * todo: remove it
   * Parse taproot input from tx input, returns null if failed
   */
  private parseTaprootInput(input: TxInput): TaprootPayment | null {
    try {
      const taproot = payments.p2tr({ witness: input.witness });
      return {
        pubkey: taproot.pubkey ? Buffer.from(taproot.pubkey) : undefined,
        redeemScript: taproot?.redeem?.output ? Buffer.from(taproot.redeem.output) : undefined,
        witness: input.witness.map((w) => Buffer.from(w)),
      };
    } catch {
      return null;
    }
  }

  /**
   * Decode delegate, note: unlike the ordinals spec, the delegate info is not stored in the witness, but stored in the tx output.data
   * @param delegate 
   * @returns 
   */
  decodeDelegate(delegate: Buffer): { txId: string; outputIndex: number } | undefined {
    try {
      const buf = Buffer.concat([delegate, Buffer.from([0x00, 0x00, 0x00, 0x00])]);
      const txId = buf.subarray(0, 32).reverse().toString('hex');
      const outputIndex = buf.subarray(32, 36).readUInt32LE();
      return { txId, outputIndex };
    } catch (e) {
      this.logger.error(`decode delegate error: ${e.message}`);
    }
    return undefined;
  }

  public async getDelegateContent(delegate: string): Promise<CachedContent | null> {
    const { txId, outputIndex } = this.decodeDelegate(Buffer.from(delegate, 'hex')) || {};
    const key = `${txId}_${outputIndex}`;
    let cached = TxService.contentCache.get(key);
    if (!cached) {
      const raw = await this.commonService.getRawTx(txId, true);
      const tx = new OpcatTransaction(raw['hex']);
      if (outputIndex < tx.outputs.length) {
        const content = await this.parseContentEnvelope(toHex(tx.outputs[outputIndex].data));
        if (content) {
          cached = content;
          if (Number(raw['confirmations']) >= Constants.CACHE_AFTER_N_BLOCKS) {
            TxService.contentCache.set(key, cached);
          }
        }
      }
    }
    return cached;
  }

  async parseContentEnvelope(data: string): Promise<CachedContent | null> {
    try {
      const info = MetadataSerializer.deserialize(data);
      const isDelegate = info?.info.delegate?.length > 0 && !info?.info.contentBody;
      if (isDelegate) {
        return this.getDelegateContent(info.info.delegate)
      }
      return {
        type: MetadataSerializer.decodeContenType(info?.info.contentType),
        encoding: info?.info.contentEncoding,
        raw: Buffer.from(info?.info.contentBody, 'hex'),
      }
    } catch (e) {
      this.logger.error(`parse content envelope error, ${e.message}`);
    }
    return null;
  }
}
