import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { riderProfileSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { RiderService } from './rider.service';
import { RiderController } from './rider.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'RiderProfile', schema: riderProfileSchema }
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [RiderService],
  controllers: [RiderController],
  exports: [RiderService],
})
export class RiderModule {}
