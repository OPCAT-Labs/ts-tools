import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('token_mint')
export class TokenMintEntity {
  @PrimaryColumn({ length: 64 })
  txid: string;

  @PrimaryColumn({ name: 'output_index' })
  outputIndex: number;

  @Column({ name: 'token_script_hash', length: 64, nullable: false })
  @Index()
  tokenScriptHash: string;

  @Column({ name: 'block_height' })
  @Index()
  blockHeight: number;

  @Column({ name: 'token_amount', type: 'decimal', nullable: true })
  tokenAmount: BigInt;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;


}