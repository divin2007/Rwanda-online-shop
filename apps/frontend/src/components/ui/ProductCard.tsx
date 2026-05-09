import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from './Button';
import { useCart } from '@/components/cart/CartContext';
import { getProductUrl } from '@/lib/urls';

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    price: number;
    unit: string;
    images: string[];
    inStock: boolean;
    marketId?: {
      slug: string;
    };
    promotion?: {
      type: 'percentage' | 'fixed_amount';
      discount: number;
      promotedPrice: number;
    };
    attributes?: Record<string, any>;
  };
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart();

  if (!product.images || product.images.length === 0) {
    return null; // CRITICAL RULE: Do not render if no images
  }

  const finalPrice = product.promotion ? product.promotion.promotedPrice : product.price;

  return (
    <div className="bg-background-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative flex flex-col h-full">
      {/* Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {product.promotion && (
          <span className="bg-status-warning text-white text-xs font-bold px-2 py-1 rounded">
            {product.promotion.type === 'percentage' ? `-${product.promotion.discount}% OFF` : `-${product.promotion.discount} RWF`}
          </span>
        )}
      </div>

      <Link href={getProductUrl(product._id, product.marketId?.slug)} className="block relative aspect-square bg-background-surface overflow-hidden">
        <Image 
          src={product.images[0]} 
          alt={product.name} 
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`object-cover transition-transform duration-500 hover:scale-105 ${!product.inStock ? 'opacity-50 grayscale' : ''}`}
        />
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-status-error text-white font-bold px-4 py-2 rounded shadow-lg transform -rotate-12">OUT OF STOCK</span>
          </div>
        )}
      </Link>
      
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-bold text-text-primary mb-1 line-clamp-2 min-h-[40px]">
          <Link href={getProductUrl(product._id, product.marketId?.slug)} className="hover:text-primary transition-colors">
            {product.name}
          </Link>
        </h3>
        
        <div className="mt-auto pt-4">
          <div className="flex items-baseline gap-2 mb-3">
            {(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) ? (
              <span className="text-lg font-bold text-primary">Price on Quote</span>
            ) : product.promotion ? (
              <>
                <span className="text-lg font-bold text-status-warning">{product.promotion.promotedPrice.toLocaleString()} RWF</span>
                <span className="text-xs text-text-muted line-through">{product.price.toLocaleString()} RWF</span>
              </>
            ) : (
              <span className="text-lg font-bold text-primary">{product.price.toLocaleString()} RWF</span>
            )}
            <span className="text-xs text-text-secondary">/{product.unit}</span>
          </div>
          
          <Button 
            variant="primary" 
            fullWidth 
            className="py-2"
            disabled={!product.inStock}
            onClick={() => addToCart(product)}
          >
            {(product.attributes?.isQuoteRequired === 'true' || product.attributes?.isQuoteRequired === true) ? 'Request Quote' : 'Add to Cart'}
          </Button>
        </div>
      </div>
    </div>
  );
};
