'use client';

import React from 'react';
import ProductDetailPage from '../../market/[slug]/product/[productId]/page';

export default function CanonicalProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = React.use(params);
  return <ProductDetailPage params={Promise.resolve({ productId })} />;
}
