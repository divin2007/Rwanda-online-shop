'use client';
import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function SellerOnboarding() {
  const [step, setStep] = useState(1);
  const [marketType, setMarketType] = useState<'public' | 'individual' | null>(null);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-2 text-center">Become a Seller</h1>
        <p className="text-text-secondary text-center mb-8">Join the Rwandan Market Facilitator platform.</p>

        {step === 1 && (
          <Card className="animate-fade-in">
            <h2 className="text-xl font-heading font-bold mb-4">Choose your market type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div 
                className={`border-2 rounded-lg p-6 cursor-pointer transition-colors ${marketType === 'public' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'}`}
                onClick={() => setMarketType('public')}
              >
                <h3 className="font-bold text-lg mb-2">Public Market</h3>
                <p className="text-sm text-text-secondary">I have a stall inside a recognized public market (e.g. Kimironko, Nyabugogo).</p>
              </div>
              <div 
                className={`border-2 rounded-lg p-6 cursor-pointer transition-colors ${marketType === 'individual' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'}`}
                onClick={() => setMarketType('individual')}
              >
                <h3 className="font-bold text-lg mb-2">Individual Shop</h3>
                <p className="text-sm text-text-secondary">I own an independent shop or supermarket outside of a public market area.</p>
              </div>
            </div>
            <Button 
              fullWidth 
              disabled={!marketType}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </Card>
        )}

        {step === 2 && (
          <Card className="animate-fade-in">
            <h2 className="text-xl font-heading font-bold mb-4">Legal & Verification</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">RDB Registration Number (Optional for pilot)</label>
                <input type="text" className="w-full border border-border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">National ID Number</label>
                <input type="text" className="w-full border border-border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Upload Stall/Shop Photo</label>
                <div className="w-full border-2 border-dashed border-border rounded p-8 text-center text-text-secondary">
                  Click to upload image
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button fullWidth onClick={() => setStep(3)}>Continue</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="animate-fade-in">
            <h2 className="text-xl font-heading font-bold mb-4">Partnership Agreement</h2>
            <div className="bg-background-surface border border-border rounded p-4 h-64 overflow-y-auto mb-4 text-sm text-text-secondary space-y-2">
              <h3 className="font-bold text-text-primary">RMF Partner Agreement v3.0</h3>
              <p>By accepting this agreement, you agree to the following core terms:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>You will pay a 1.5% commission on each product sold (minimum 100 RWF).</li>
                <li>You must prepare goods immediately upon order confirmation.</li>
                <li>You accept liability for incorrect or damaged goods.</li>
                <li>All products must have at least one clear photograph to be listed.</li>
              </ul>
            </div>
            
            <div className="flex items-start gap-2 mb-6">
              <input type="checkbox" id="agree" className="mt-1" />
              <label htmlFor="agree" className="text-sm font-medium text-text-primary">
                I have read and agree to the Partnership Agreement v3.0
              </label>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button fullWidth onClick={() => alert('Application submitted!')}>Accept & Submit</Button>
            </div>
          </Card>
        )}

      </div>
    </Layout>
  );
}
