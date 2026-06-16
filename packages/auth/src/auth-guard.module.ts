import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({})
export class AuthGuardModule {
  static forRoot(options?: { globalGuard?: boolean }): DynamicModule {
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be set in production environment variables.');
    }
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

    const providers: Provider[] = [JwtStrategy];

    // Optionally register JwtAuthGuard + RolesGuard as global guards
    if (options?.globalGuard !== false) {
      providers.push(
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard }
      );
    }

    return {
      module: AuthGuardModule,
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers,
      exports: [PassportModule, JwtModule, JwtStrategy],
    };
  }
}
