'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      alert('Registration functionality connected! (Mock)');
    }, 1500);
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
        <div className="w-full max-w-lg">
          <Card className="shadow-xl border-t-4 border-t-secondary animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-heading font-bold text-text-primary">Create an Account</h1>
              <p className="text-text-secondary">Join Rwanda's premier digital marketplace</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="firstName">First Name</label>
                  <input
                    id="firstName" name="firstName" type="text" required
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="Jean" value={formData.firstName} onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName" name="lastName" type="text" required
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="Claude" value={formData.lastName} onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="email">Email Address</label>
                <input
                  id="email" name="email" type="email" required
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="name@example.com" value={formData.email} onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="phone">Phone Number</label>
                <input
                  id="phone" name="phone" type="tel" required
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="078..." value={formData.phone} onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="password">Password</label>
                <input
                  id="password" name="password" type="password" required minLength={8}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="••••••••" value={formData.password} onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword" name="confirmPassword" type="password" required minLength={8}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange}
                />
              </div>

              <div className="flex items-start mt-2">
                <input id="terms" type="checkbox" required className="mt-1 h-4 w-4 text-primary border-border rounded focus:ring-primary" />
                <label htmlFor="terms" className="ml-2 block text-sm text-text-secondary">
                  I agree to the <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </label>
              </div>

              <Button type="submit" fullWidth size="lg" disabled={isLoading} className="mt-6">
                {isLoading ? 'Creating Account...' : 'Register'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-sm text-text-secondary">
                Already have an account?{' '}
                <Link href="/login" className="text-primary font-bold hover:underline">Sign In</Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
