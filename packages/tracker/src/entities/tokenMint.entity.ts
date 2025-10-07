import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('token_mint')
@Index(['tokenPubKey'])
export class TokenMintEntity {
  @PrimaryColumn({ length: 64 })
  txid: string;

  // tokenInfo.tokenScriptHash
  @Column({ name: 'token_pubkey', length: 64 })
  tokenPubKey: string;

  @Column({ name: 'block_height' })
  @Index()
  blockHeight: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
