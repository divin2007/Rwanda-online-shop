import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { menuSchema, sellerProfileSchema } from '@rmf/database';
import { AuthGuardModule } from '@rmf/auth';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Menu', schema: menuSchema },
      { name: 'SellerProfile', schema: sellerProfileSchema },
    ]),
    // Guards are already registered globally by SellerModule's AuthGuardModule.
    // Import the Jwt/Passport infrastructure here WITHOUT re-registering global
    // APP_GUARDs to avoid running JwtAuthGuard/RolesGuard twice per request.
    AuthGuardModule.forRoot({ globalGuard: false }),
  ],
  providers: [MenuService],
  controllers: [MenuController],
  exports: [MenuService],
})
export class MenuModule {}
