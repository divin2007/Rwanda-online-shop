import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-heading font-bold mb-8">Privacy Policy</h1>
        <Card className="prose prose-slate max-w-none">
          <p>Last updated: May 3, 2026</p>
          <p>Your privacy is important to us. This policy explains how we collect and use your data.</p>
          <h2>1. Data Collection</h2>
          <p>We collect location data for delivery tracking and contact information for order fulfillment.</p>
          <h2>2. Data Usage</h2>
          <p>Your data is used solely to provide the marketplace services and improve user experience.</p>
          <h2>3. Third-Party Sharing</h2>
          <p>We only share necessary data with riders and payment providers to complete your orders.</p>
        </Card>
      </div>
    </Layout>
  );
}
