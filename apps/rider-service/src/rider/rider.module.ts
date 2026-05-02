import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { riderProfileSchema } from '@rmf/database';
import { RiderService } from './rider.service';
import { RiderController } from './rider.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'RiderProfile', schema: riderProfileSchema }
    ]),
  ],
  providers: [RiderService],
  controllers: [RiderController],
  exports: [RiderService],
})
export class RiderModule {}
