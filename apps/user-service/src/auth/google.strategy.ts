import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    const clientID = process.env.GOOGLE_CLIENT_ID || 'missing-client-id';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'missing-client-secret';

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn('CRITICAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google Auth will not work.');
    }

    super({
      clientID,
      clientSecret,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails?.[0]?.value,
      fullName: name?.givenName + ' ' + (name?.familyName || ''),
      avatarUrl: photos?.[0]?.value,
      googleId: profile.id,
      accessToken,
    };
    done(null, user);
  }
}
