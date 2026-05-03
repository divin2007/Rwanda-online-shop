import React from 'react';
import { Layout } from '@/components/layout/Layout';

export default function Loading() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-border"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        <p className="mt-6 text-text-secondary font-medium animate-pulse">Loading Rwanda Market...</p>
      </div>
    </Layout>
  );
}
