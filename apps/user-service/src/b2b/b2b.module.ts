import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { b2bAccountSchema } from '@rmf/database';
import { B2bService } from './b2b.service';
import { B2bController } from './b2b.controller';

@Module({
  imports: [
    PassportModule,
    MongooseModule.forFeature([{ name: 'B2BAccount', schema: b2bAccountSchema }]),
  ],
  providers: [B2bService],
  controllers: [B2bController],
})
export class B2bModule {}
