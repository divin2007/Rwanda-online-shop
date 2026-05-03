'use client';
import React, { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-3xl font-heading font-bold text-text-primary mb-4">Something went wrong!</h2>
        <p className="text-text-secondary max-w-md mx-auto mb-8">
          We encountered an unexpected error while trying to load this page. Our engineers have been notified.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => reset()} variant="primary">
            Try again
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    </Layout>
  );
}
