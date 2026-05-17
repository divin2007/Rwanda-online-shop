'use client';
import React, { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export const Card = ({ children, className = '', noPadding = false, ...props }: CardProps) => {
  return (
    <div 
      className={`rounded-lg border border-border bg-background-card shadow-sm ${noPadding ? '' : 'p-4 sm:p-6'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
