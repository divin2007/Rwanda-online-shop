import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';

export default function TermsPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-heading font-bold mb-8">Terms of Service</h1>
        <Card className="prose prose-slate max-w-none">
          <p>Last updated: May 3, 2026</p>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing and using Rwanda Market Facilitator, you agree to be bound by these Terms of Service.</p>
          <h2>2. Description of Service</h2>
          <p>We provide a digital marketplace connecting Rwandan physical markets with online buyers and delivery riders.</p>
          <h2>3. User Responsibilities</h2>
          <p>Users must provide accurate information and comply with Rwandan e-commerce laws.</p>
          <h2>4. Payments</h2>
          <p>Payments are handled via integrated mobile money services. Commissions are automatically deducted.</p>
        </Card>
      </div>
    </Layout>
  );
}
