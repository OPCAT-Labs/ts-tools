import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { TokenModule } from '../token/token.module';
import { CommonModule } from '../../services/common/common.module';
import { TxService } from '../tx/tx.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TxOutEntity } from '../../entities/txOut.entity';

@Module({
  imports: [TokenModule, CommonModule, TypeOrmModule.forFeature([TxOutEntity])],
  providers: [AddressService, TxService],
  controllers: [AddressController],
})
export class AddressModule {}
