'use client';
import React from 'react';
import Image from 'next/image';
import { Card } from './Card';
import { Button } from './Button';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    unit: string;
    image: string;
    inStock: boolean;
    promotion?: {
      type: 'percentage' | 'fixed_amount';
      discount: number;
      promotedPrice: number;
    };
  };
  onAddToCart: (id: string) => void;
}

export const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  return (
    <Card noPadding className="overflow-hidden flex flex-col h-full group hover:shadow-md transition-shadow">
      <div className="relative h-48 w-full bg-background-surface">
        {/* Stubbing Image for demo */}
        <div className="absolute inset-0 flex items-center justify-center text-text-muted bg-gray-200">
          [Product Image]
        </div>
        
        {product.promotion && (
          <div className="absolute top-2 left-2 bg-status-error text-text-inverse px-2 py-1 text-xs font-bold rounded shadow-sm">
            {product.promotion.type === 'percentage' 
              ? `-${product.promotion.discount}% OFF` 
              : `-${product.promotion.discount} RWF`}
          </div>
        )}
        
        {!product.inStock && (
          <div className="absolute inset-0 bg-background-main/70 flex items-center justify-center">
            <span className="bg-secondary text-text-inverse px-3 py-1 rounded font-medium text-sm">
              Out of Stock
            </span>
          </div>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-heading font-medium text-text-primary text-lg mb-1 truncate" title={product.name}>
          {product.name}
        </h3>
        
        <div className="mt-auto pt-2">
          {product.promotion ? (
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-primary dark:text-status-warning drop-shadow-sm">
                {product.promotion.promotedPrice} RWF
              </span>
              <span className="text-sm text-text-muted line-through">
                {product.price}
              </span>
              <span className="text-xs text-text-secondary">/{product.unit}</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-text-primary">
                {product.price} RWF
              </span>
              <span className="text-sm text-text-secondary">/{product.unit}</span>
            </div>
          )}
        </div>
        
        <Button 
          variant="primary" 
          fullWidth 
          className="mt-4 py-2"
          disabled={!product.inStock}
          onClick={() => onAddToCart(product.id)}
        >
          Add to Cart
        </Button>
      </div>
    </Card>
  );
};
