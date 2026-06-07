import { Controller, Get, Param, Res, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AffiliateService } from './affiliate.service';

/**
 * Public referral short-link (Feature 3). Resolves a slug, sets the rmf_ref cookie,
 * and 302-redirects to the product page on the storefront.
 *
 * SECURITY: rate-limited to 3 requests / IP / hour to deter click fraud and scraping.
 */
@Controller()
export class ReferralRedirectController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Get('r/:slug')
  async redirect(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    const frontendBase = process.env.FRONTEND_PUBLIC_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000';
    const resolved = await this.affiliateService.resolveSlug(slug);
    if (!resolved) {
      return res.status(404).send('Referral link not found');
    }

    // 7-day attribution cookie on the API domain (same-domain fallback). The storefront
    // lives on a different origin and cannot read this cookie, so the slug is ALSO passed
    // as a ?ref query param; the frontend persists its own readable rmf_ref cookie.
    res.cookie('rmf_ref', slug, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.redirect(302, `${frontendBase}/product/${resolved.productId}?ref=${encodeURIComponent(slug)}`);
  }
}
