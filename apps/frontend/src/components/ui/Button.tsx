'use client';
import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  loading = false,
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex justify-center items-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary text-secondary hover:bg-primary-hover focus:ring-primary',
    secondary: 'bg-secondary text-text-inverse hover:bg-secondary-hover focus:ring-secondary',
    outline: 'border border-border text-text-primary hover:bg-background-surface focus:ring-primary',
    ghost: 'text-text-primary hover:bg-background-surface focus:ring-primary',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-sm',
    md: 'px-4 py-2 text-base rounded',
    lg: 'px-6 py-3 text-lg rounded-md',
  };

  const classes = `
    ${baseStyles}
    ${variants[variant]}
    ${sizes[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="opacity-0">{children}</span>
      ) : (
        children
      )}
      {loading && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          ...
        </span>
      )}
    </button>
  );
};
