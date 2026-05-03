'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { userApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await userApi.post('/auth/login', { email, password });
      if (res.data?.success) {
        const { accessToken, user } = res.data.data;
        login(user, accessToken);
        toast.success('Successfully logged in!');
        
        // Role-based redirection
        if (user.role === 'SELLER') router.push('/seller/dashboard');
        else if (user.role === 'RIDER') router.push('/rider/dashboard');
        else if (user.role === 'ADMIN') router.push('/admin');
        else router.push('/');
      } else {
        toast.error(res.data?.error || 'Login failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to connect to authentication service');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_USER_SERVICE_URL}/auth/google`;
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-t-4 border-t-primary animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-heading font-bold text-text-primary">Welcome Back</h1>
              <p className="text-text-secondary">Login to your Rwanda Market account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2" htmlFor="email">Email Address</label>
                <input
                  id="email" type="email" required
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2" htmlFor="password">Password</label>
                <input
                  id="password" type="password" required
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background-surface focus:ring-2 focus:ring-primary outline-none"
                  placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" fullWidth size="lg" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between">
              <span className="w-1/5 border-b border-border"></span>
              <span className="text-xs text-text-muted uppercase">or</span>
              <span className="w-1/5 border-b border-border"></span>
            </div>

            <button 
              onClick={handleGoogleAuth}
              className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-background-surface transition-colors font-medium"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>

            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-sm text-text-secondary">
                Don't have an account? <Link href="/register" className="text-primary font-bold hover:underline">Register</Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
