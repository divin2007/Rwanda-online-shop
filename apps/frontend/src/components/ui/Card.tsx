import React, { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export const Card = ({ children, className = '', noPadding = false, ...props }: CardProps) => {
  return (
    <div 
      className={`bg-background-card rounded shadow border border-border ${noPadding ? '' : 'p-4 sm:p-6'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
