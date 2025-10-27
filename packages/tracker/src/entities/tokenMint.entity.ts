import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('token_mint')
export class TokenMintEntity {
  @PrimaryColumn({ length: 64 })
  txid: string;

  @Column({ name: 'token_script_hash', length: 64, nullable: true })
  @Index()
  tokenScriptHash: string;

  @Column({ name: 'block_height' })
  @Index()
  blockHeight: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'token_amount', type: 'bigint', nullable: true })
  tokenAmount: bigint;

}