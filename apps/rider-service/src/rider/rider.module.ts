import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { riderProfileSchema, userSchema, deliverySchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { RiderService } from './rider.service';
import { RiderController } from './rider.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'RiderProfile', schema: riderProfileSchema },
      { name: 'User', schema: userSchema },
      { name: 'Delivery', schema: deliverySchema },
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [RiderService],
  controllers: [RiderController],
  exports: [RiderService],
})
export class RiderModule {}
