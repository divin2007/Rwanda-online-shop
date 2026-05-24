import { SellerVideoService } from './seller-video.service';
import { BadRequestException } from '@nestjs/common';

describe('SellerVideoService - Stories Recommendation Engine & Expiration', () => {
  let service: SellerVideoService;
  let mockSellerVideoModel: any;
  let mockUserModel: any;

  beforeEach(() => {
    // High-fidelity Mock Mongoose models
    mockSellerVideoModel = {
      updateMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: 'story-1',
            placement: 'STORY',
            categoryId: 'grocery',
            title: 'Fresh Carrots Musanze',
            caption: 'Fresh carrots from volcanic soil',
            videoUrl: 'http://cdn.com/carrots.mp4',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
            sellerId: { rating: 4.8 },
            likeUserIds: [],
          },
          {
            _id: 'story-2',
            placement: 'STORY',
            categoryId: 'handicrafts',
            title: 'Imigongo Painting',
            caption: 'Traditional art by local cooperatives',
            videoUrl: 'http://cdn.com/art.mp4',
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
            sellerId: { rating: 4.5 },
            likeUserIds: [],
          },
          {
            _id: 'story-3',
            placement: 'STORY',
            categoryId: 'other',
            title: 'General Promo',
            caption: 'Random market clip',
            videoUrl: 'http://cdn.com/promo.mp4',
            createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(), // 11 hours ago
            sellerId: { rating: 3.5 },
            likeUserIds: [],
          }
        ]),
      }),
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };

    mockUserModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: 'user-1',
          preferences: {
            discovery: {
              categoryIds: ['handicrafts'], // Explicit favorite category
            }
          },
          recommendationProfile: {
            categoryScores: [
              { key: 'grocery', score: 100 } // Behavioral scoring boost
            ]
          }
        }),
      }),
    };

    service = new SellerVideoService(
      mockSellerVideoModel as any,
      {} as any, // sellerModel
      {} as any, // productModel
      {} as any, // marketModel
      mockUserModel as any,
    );
  });

  describe('archiveExpiredStories', () => {
    it('executes updateMany targeting STORY placements older than 24 hours', async () => {
      await service.archiveExpiredStories();
      expect(mockSellerVideoModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          placement: 'STORY',
          isArchived: false,
          createdAt: expect.any(Object),
        }),
        expect.objectContaining({
          $set: { isArchived: true }
        })
      );
    });
  });

  describe('getPersonalizedStories', () => {
    it('returns stories ranked by the hybrid scoring algorithm (explicit favorites first, then behavioral scores, quality, and recency)', async () => {
      const user = { userId: 'user-1', role: 'BUYER' };
      const results = await service.getPersonalizedStories(user, {});

      expect(results).toHaveLength(3);
      
      // story-2 has category 'handicrafts', which is the user's explicit favorite (+500 points boost).
      // It should rank first.
      expect(results[0]._id).toBe('story-2');

      // story-1 has category 'grocery', which has behavioral score 100 (+200 points boost).
      // It should rank second.
      expect(results[1]._id).toBe('story-1');

      // story-3 has no category matches and should be third.
      expect(results[2]._id).toBe('story-3');
    });

    it('gracefully falls back to sorting by creation date for anonymous/guest users', async () => {
      const results = await service.getPersonalizedStories(undefined, {});

      expect(results).toHaveLength(3);
      // Sorted strictly by creation date descending: 1h ago -> 6h ago -> 11h ago
      expect(results[0]._id).toBe('story-1');
      expect(results[1]._id).toBe('story-2');
      expect(results[2]._id).toBe('story-3');
    });
  });
});
