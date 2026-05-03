import React from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';

// Mock data to be replaced with real API call later
const MOCK_PRODUCT = {
  id: 'p1',
  name: 'Fresh Tomatoes (Inyanya)',
  price: 1200,
  unit: 'kg',
  images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&q=80'],
  inStock: true,
  description: 'Fresh, locally grown tomatoes sourced directly from Rwandan farmers. Perfect for salads, sauces, and daily cooking.',
  seller: {
    id: 's1',
    name: 'Mama Kevin Veggies',
    rating: 4.8,
    reviews: 124,
    stallId: 'ST-045'
  },
  category: 'Vegetables'
};

export default function ProductDetailPage({ params }: { params: { slug: string, productId: string } }) {
  // We will integrate productApi.get(`/products/${params.productId}`) here later

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Breadcrumb */}
        <nav className="text-sm font-medium text-text-secondary mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/markets" className="hover:text-primary">Markets</Link>
          <span className="mx-2">/</span>
          <Link href={`/market/${params.slug}`} className="hover:text-primary capitalize">{params.slug}</Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary">{MOCK_PRODUCT.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Product Images */}
          <div>
            <div className="aspect-square bg-background-surface rounded-2xl overflow-hidden border border-border mb-4 relative">
              {MOCK_PRODUCT.images.length > 0 ? (
                <img src={MOCK_PRODUCT.images[0]} alt={MOCK_PRODUCT.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted">No Image</div>
              )}
            </div>
            {/* Thumbnail Gallery (if multiple images) */}
            {MOCK_PRODUCT.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {MOCK_PRODUCT.images.map((img, idx) => (
                  <div key={idx} className="aspect-square rounded-lg border border-border overflow-hidden cursor-pointer hover:border-primary">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <h1 className="text-4xl font-heading font-bold text-text-primary mb-2">{MOCK_PRODUCT.name}</h1>
            <div className="flex items-center gap-4 mb-6">
              <span className="text-2xl font-bold text-primary">{MOCK_PRODUCT.price} RWF</span>
              <span className="text-text-secondary">/ {MOCK_PRODUCT.unit}</span>
              {MOCK_PRODUCT.inStock ? (
                <span className="bg-status-success/10 text-status-success text-xs font-bold px-2 py-1 rounded">In Stock</span>
              ) : (
                <span className="bg-status-error/10 text-status-error text-xs font-bold px-2 py-1 rounded">Out of Stock</span>
              )}
            </div>

            <p className="text-text-secondary mb-8 leading-relaxed">
              {MOCK_PRODUCT.description}
            </p>

            {/* Seller Info Card */}
            <div className="bg-background-surface border border-border rounded-xl p-4 mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-1">Sold By</p>
                <p className="font-bold text-text-primary">{MOCK_PRODUCT.seller.name}</p>
                <p className="text-sm text-text-secondary">Stall: {MOCK_PRODUCT.seller.stallId}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-status-warning font-bold mb-1">
                  ⭐ {MOCK_PRODUCT.seller.rating}
                </div>
                <p className="text-xs text-text-secondary">({MOCK_PRODUCT.seller.reviews} reviews)</p>
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex gap-4">
                <Button size="lg" className="flex-1" disabled={!MOCK_PRODUCT.inStock}>
                  Add to Cart
                </Button>
                <Button size="lg" variant="outline" className="flex-1">
                  Buy Now
                </Button>
              </div>
              <p className="text-center text-xs text-text-muted mt-4">
                Delivery calculated at checkout based on your location.
              </p>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-20 pt-10 border-t border-border">
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-6">Customer Reviews</h2>
          <div className="bg-background-surface rounded-2xl p-8 text-center text-text-secondary">
            <p>No reviews yet. Be the first to review this product!</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
