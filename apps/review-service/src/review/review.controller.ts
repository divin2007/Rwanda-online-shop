import { Controller, Get, Post, Body, Param, Request } from '@nestjs/common';
import { ReviewService } from './review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  async submitReview(@Body() data: {
    orderId: string;
    buyerId: string;
    targetType: 'seller' | 'rider';
    targetId: string;
    rating: number;
    comment?: string;
  }) {
    const review = await this.reviewService.submitReview(data);
    return { success: true, data: review };
  }

  @Get('me')
  async getMyReviews(@Request() req: any) {
    if (!req.user) {
        const reviews = await this.reviewService.getReviewsForTarget('seller', "dummy");
        return { success: true, data: reviews };
    }
    const reviews = await this.reviewService.getReviewsForTarget('seller', req.user.id);
    return { success: true, data: reviews };
  }

  @Get('target/:type/:id')
  async getReviews(@Param('type') type: 'seller' | 'rider', @Param('id') id: string) {
    const reviews = await this.reviewService.getReviewsForTarget(type, id);
    return { success: true, data: reviews };
  }
}
