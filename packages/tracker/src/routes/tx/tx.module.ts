import { Module } from '@nestjs/common';
import { TxService } from './tx.service';
import { TxController } from './tx.controller';
import { TokenModule } from '../token/token.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TxOutEntity } from '../../entities/txOut.entity';
import { TxOutArchiveEntity } from '../../entities/txOutArchive.entity';
import { TokenInfoEntity } from '../../entities/tokenInfo.entity';
import { CommonModule } from '../../services/common/common.module';

@Module({
  imports: [TokenModule, CommonModule, TypeOrmModule.forFeature([TxOutEntity, TxOutArchiveEntity, TokenInfoEntity])],
  providers: [TxService],
  controllers: [TxController],
  exports: [TxService],
})
export class TxModule {}
