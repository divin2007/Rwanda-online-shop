import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { errandSchema, riderProfileSchema, userSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { ErrandService } from './errand.service';
import { ErrandController } from './errand.controller';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Errand', schema: errandSchema },
      { name: 'RiderProfile', schema: riderProfileSchema },
      { name: 'User', schema: userSchema },
    ]),
    AuthGuardModule.forRoot(),
    forwardRef(() => DeliveryModule),
  ],
  providers: [ErrandService],
  controllers: [ErrandController],
})
export class ErrandModule {}
