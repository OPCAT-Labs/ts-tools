import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('tx_out_archive')
export class TxOutArchiveEntity {
  @PrimaryColumn({ length: 64 })
  txid: string;

  @PrimaryColumn({ name: 'output_index' })
  outputIndex: number;

  @Column({ name: 'block_height', default: 2147483647 })
  @Index()
  blockHeight: number;

  @Column({ type: 'bigint' })
  satoshis: bigint;

  @Column({ name: 'locking_script_hash' })
  lockingScriptHash: string;

  @Column({ name: 'is_from_mint' })
  isFromMint: boolean;

  @Column({ name: 'owner_pkh', nullable: true })
  @Index()
  ownerPubKeyHash: string;

  @Column({ name: 'token_amount', type: 'decimal', nullable: true })
  tokenAmount: bigint;

  @Column({ name: 'data' })
  data: string;

  @Column({ name: 'spend_txid', nullable: true })
  spendTxid: string;

  @Column({ name: 'spend_input_index', nullable: true })
  spendInputIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'update_at' })
  updatedAt: Date;
}
