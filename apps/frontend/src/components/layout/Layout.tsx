'use client';
import React, { ReactNode } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/cart/CartContext';

interface LayoutProps {
  children: ReactNode;
  marketName?: string;
}

export const Layout = ({ children, marketName }: LayoutProps) => {
  const { cartCount } = useCart();

  return (
    <div className="min-h-screen bg-background-main flex flex-col font-sans">
      <header className="bg-background-card border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-secondary">
                  RM
                </div>
                <span className="font-heading font-bold text-xl text-text-primary">
                  {marketName || 'Rwandan Market Facilitator'}
                </span>
              </Link>
            </div>
            <nav className="flex space-x-4 items-center">
              <Link href="/cart" className="text-text-secondary hover:text-primary transition-colors relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="absolute -top-1 -right-1 bg-status-error text-text-inverse text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              </Link>
              <div className="h-6 w-px bg-border mx-2"></div>
              <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary">Log In</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-secondary text-text-inverse py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-text-muted">© 2026 Rwandan Market Facilitator</p>
          <div className="flex space-x-4 mt-4 md:mt-0 text-sm text-text-muted">
            <Link href="/terms" className="hover:text-text-inverse">Terms</Link>
            <Link href="/privacy" className="hover:text-text-inverse">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
