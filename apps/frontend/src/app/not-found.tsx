import React from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="text-9xl mb-8">🧭</div>
        <h1 className="text-5xl font-heading font-extrabold text-text-primary mb-4">404</h1>
        <h2 className="text-2xl font-bold text-text-secondary mb-6">Page Not Found</h2>
        <p className="text-text-secondary max-w-md mx-auto mb-8">
          We looked everywhere in the market, but we couldn't find the page you're looking for. It might have been moved or deleted.
        </p>
        <Link href="/">
          <Button size="lg">Return to Marketplace</Button>
        </Link>
      </div>
    </Layout>
  );
}
