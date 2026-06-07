import mongoose from 'mongoose';

// Export all schemas
export * from './schemas/user.schema';
export * from './schemas/seller-profile.schema';
export * from './schemas/rider-profile.schema';
export * from './schemas/market.schema';
export * from './schemas/product.schema';
export * from './schemas/taxonomy-category.schema';
export * from './schemas/promotion.schema';
export * from './schemas/seller-video.schema';
export * from './schemas/profile-change-request.schema';
export * from './schemas/transaction.schema';
export * from './schemas/delivery.schema';
export * from './schemas/audit-log.schema';
export * from './schemas/notification-log.schema';
export * from './schemas/wallet.schema';
export * from './schemas/payout-request.schema';
export * from './schemas/ledger-entry.schema';
export * from './schemas/review.schema';
export * from './schemas/rider-rejection.schema';
export * from './schemas/contract.schema';
export * from './schemas/support-ticket.schema';
export * from './schemas/menu.schema';

// ── Platform expansion schemas (12-feature mission) ──────────────────
export * from './schemas/group-buy.schema';
export * from './schemas/live-session.schema';
export * from './schemas/affiliate-profile.schema';
export * from './schemas/referral-link.schema';
export * from './schemas/affiliate-application.schema';
export * from './schemas/errand.schema';
export * from './schemas/b2b-account.schema';
export * from './schemas/bulk-delivery-request.schema';
export * from './schemas/recurring-order-template.schema';
export * from './schemas/invoice.schema';
export * from './schemas/catering-brief.schema';
export * from './schemas/catering-bid.schema';
export * from './schemas/export-inquiry.schema';
export * from './schemas/price-index.schema';


// Connection manager
export const connectDatabase = async (uri: string) => {
  if (mongoose.connection.readyState >= 1) return;
  
  try {
    await mongoose.connect(uri, {
      autoIndex: true, // Should be false in production, but good for now
    });
    console.log('Successfully connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB', error);
    throw error;
  }
};
