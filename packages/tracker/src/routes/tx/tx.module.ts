import { Module } from '@nestjs/common';
import { TxService } from './tx.service';
import { TxController } from './tx.controller';
import { TokenModule } from '../token/token.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TxOutEntity } from '../../entities/txOut.entity';
import { CommonModule } from '../../services/common/common.module';

@Module({
  imports: [TokenModule, CommonModule,TypeOrmModule.forFeature([TxOutEntity])],
  providers: [TxService],
  controllers: [TxController],
  exports: [TxService],
})
export class TxModule {}
