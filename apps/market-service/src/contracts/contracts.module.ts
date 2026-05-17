import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { contractSchema } from '@rmf/database';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Contract', schema: contractSchema }]),
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
