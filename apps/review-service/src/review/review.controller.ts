import { Controller, Get, Post, Body, Param, Request, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ReviewService } from './review.service';
import { JwtAuthGuard, Public } from '@rmf/auth';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // FIX [REVIEW-1]: Was fully public with no auth — anyone could submit unlimited fake reviews
  // with arbitrary buyerIds, enabling reputation poisoning attacks.
  // Now requires JWT. buyerId is taken from the token, not the request body.
  @UseGuards(JwtAuthGuard)
  @Post()
  async submitReview(@Body() data: {
    orderId: string;
    targetType: 'seller' | 'rider' | 'market' | 'product';
    targetId: string;
    rating: number;
    comment?: string;
  }, @Request() req: any) {
    if (!data.rating || data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    if (!data.orderId || !data.targetType || !data.targetId) {
      throw new BadRequestException('orderId, targetType, and targetId are required');
    }
    const review = await this.reviewService.submitReview({
      ...data,
      buyerId: req.user.userId, // Always use JWT identity, never trust body
    });
    return { success: true, data: review };
  }

  @UseGuards(JwtAuthGuard)
  @Get('order/:orderId')
  async getOrderReviews(@Param('orderId') orderId: string, @Request() req: any) {
    const reviews = await this.reviewService.getReviewsForOrder(orderId, req.user.userId);
    return { success: true, data: reviews };
  }

  // FIX [REVIEW-ME]: Was using query param userId fallback — IDOR bypass.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyReviews(@Request() req: any) {
    const userId = req.user.userId;
    const reviews = await this.reviewService.getReviewsForTarget('seller', userId);
    return { success: true, data: reviews };
  }

  // Public read — reviews for a product/seller/rider are public marketplace data
  @Public()
  @Get('target/:type/:id')
  async getReviews(@Param('type') type: 'seller' | 'rider' | 'market' | 'product', @Param('id') id: string) {
    const validTypes = ['seller', 'rider', 'market', 'product'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid target type. Must be one of: ${validTypes.join(', ')}`);
    }
    const reviews = await this.reviewService.getReviewsForTarget(type, id);
    return { success: true, data: reviews };
  }
}
