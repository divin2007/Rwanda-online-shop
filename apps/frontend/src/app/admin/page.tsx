import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdminContent } from './AdminContent';

export default function AdminDashboard() {
  return (
    <Layout marketName="RMF Admin Panel">
      <AdminContent />
    </Layout>
  );
}
