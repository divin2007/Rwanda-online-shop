import { productApi, userApi } from '@/lib/api';

type ProductSignal = {
  _id?: string;
  id?: string;
  categoryId?: string;
  category?: string;
  marketId?: string | { _id?: string };
  sellerId?: string | { _id?: string };
};

const idFrom = (value: unknown) => typeof value === 'object' && value
  ? String((value as { _id?: string })._id || '')
  : String(value || '');

export const trackProductSignal = (product: ProductSignal, action: string) => {
  const productId = product._id || product.id;
  if (!productId) return;
  productApi.post(`/products/${productId}/interactions`, { action }).catch(() => {
    userApi.post('/users/recommendations/interactions', {
      action,
      productId,
      categoryId: product.categoryId || product.category,
      marketId: idFrom(product.marketId),
      sellerId: idFrom(product.sellerId),
    }).catch(() => undefined);
  });
};

export const trackCategorySignal = (categoryId: string, action = 'view') => {
  if (!categoryId) return;
  userApi.post('/users/recommendations/interactions', { action, categoryId }).catch(() => undefined);
};
