import '../env';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('CRITICAL: JWT_SECRET must be set in production environment variables.');
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
