import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { groupBuySchema, transactionSchema, productSchema, sellerProfileSchema, userSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { GroupBuyService } from './group-buy.service';
import { GroupBuyController } from './group-buy.controller';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'GroupBuy', schema: groupBuySchema },
      { name: 'Transaction', schema: transactionSchema },
      { name: 'Product', schema: productSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
      { name: 'User', schema: userSchema },
    ]),
    AuthGuardModule.forRoot(),
    OrderModule, // provides OrderGateway
  ],
  providers: [GroupBuyService],
  controllers: [GroupBuyController],
  exports: [GroupBuyService],
})
export class GroupBuyModule {}
