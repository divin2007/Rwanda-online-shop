import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { notificationLogSchema, userSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'NotificationLog', schema: notificationLogSchema },
      { name: 'User', schema: userSchema },
    ]),
    AuthGuardModule.forRoot(),
  ],
  providers: [NotificationService, NotificationGateway],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
