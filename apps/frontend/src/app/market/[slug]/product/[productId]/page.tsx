'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { productApi } from '@/lib/api';
import { useCart } from '@/components/cart/CartContext';
import toast from 'react-hot-toast';

export default function ProductDetailPage({ params }: { params: { slug: string, productId: string } }) {
  const { data: product, loading, execute: fetchProduct } = useApi(productApi, 'get', `/products/${params.productId}`);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchProduct();
  }, [params.productId, fetchProduct]);

  const handleAddToCart = () => {
    if (product) {
      addToCart({
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.imageUrl || 'https://placehold.co/400x400/000000/FFFFFF/png?text=No+Image',
        quantity: 1
      });
      toast.success(`${product.name} added to cart`);
    }
  };

  if (loading) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  if (!product) return <Layout><div className="p-20 text-center">Product not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Breadcrumb */}
        <nav className="text-sm font-medium text-text-secondary mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/markets" className="hover:text-primary">Markets</Link>
          <span className="mx-2">/</span>
          <Link href={`/market/${params.slug}`} className="hover:text-primary capitalize">{params.slug.replace(/-/g, ' ')}</Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Product Images */}
          <div>
            <div className="aspect-square bg-background-surface rounded-2xl overflow-hidden border border-border mb-4 relative">
              <img src={product.imageUrl || 'https://placehold.co/800x800/000000/FFFFFF/png?text=No+Image'} alt={product.name} className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <h1 className="text-4xl font-heading font-bold text-text-primary mb-2">{product.name}</h1>
            <div className="flex items-center gap-4 mb-6">
              <span className="text-2xl font-bold text-primary">{product.price.toLocaleString()} RWF</span>
              <span className="text-text-secondary">/ {product.unit || 'unit'}</span>
              {product.inStock ? (
                <span className="bg-status-success/10 text-status-success text-xs font-bold px-2 py-1 rounded">In Stock</span>
              ) : (
                <span className="bg-status-error/10 text-status-error text-xs font-bold px-2 py-1 rounded">Out of Stock</span>
              )}
            </div>

            <p className="text-text-secondary mb-8 leading-relaxed">
              {product.description || 'No description available for this product.'}
            </p>

            {/* Seller Info Card */}
            <div className="bg-background-surface border border-border rounded-xl p-4 mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-1">Sold By</p>
                <p className="font-bold text-text-primary">{product.seller?.name || 'Verified Seller'}</p>
                <p className="text-sm text-text-secondary">Stall: {product.stallId || 'N/A'}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-status-warning font-bold mb-1">
                  ⭐ {product.seller?.rating || 'New'}
                </div>
                <p className="text-xs text-text-secondary">Market: {params.slug.replace(/-/g, ' ')}</p>
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex gap-4">
                <Button size="lg" className="flex-1" disabled={!product.inStock} onClick={handleAddToCart}>
                  Add to Cart
                </Button>
                <Link href="/cart" className="flex-1">
                  <Button size="lg" variant="outline" className="w-full" onClick={handleAddToCart}>
                    Buy Now
                  </Button>
                </Link>
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
            <p>No reviews yet for this product. Be the first to review!</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
