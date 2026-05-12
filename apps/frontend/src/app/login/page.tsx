'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { userApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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
        toast.success('Welcome back!');
        if (user.role === 'SELLER') router.push('/seller/dashboard');
        else if (user.role === 'RIDER') router.push('/rider/dashboard');
        else if (user.role === 'ADMIN') router.push('/admin');
        else router.push('/');
      } else {
        toast.error(res.data?.error || 'Login failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Incorrect email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_USER_SERVICE_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen flex font-sans selection:bg-[#F59E0B] selection:text-white">

      {/* ── Left: Brand Panel ── */}
      <div className="hidden lg:flex w-[46%] bg-[#121212] flex-col justify-between p-16 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_70%,rgba(163,77,21,0.15),transparent_60%)]" />
          <div className="absolute -bottom-8 -right-8 text-[220px] font-serif italic leading-none select-none opacity-[0.04] text-white">RMF</div>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-baseline gap-2 group">
            <span className="text-4xl font-serif font-black tracking-tighter text-white group-hover:text-[#F59E0B] transition-colors">RMF</span>
            <div className="w-2 h-2 bg-[#F59E0B] rounded-full" />
          </Link>
          <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.5em] mt-2">Rwanda Market Facilitator</p>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-8 h-px bg-[#F59E0B]" />
            <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.5em]">Welcome Back</p>
          </div>
          <h2 className="text-6xl font-serif italic tracking-tighter leading-[0.95] text-white">
            Your local<br />
            <span className="text-[#F59E0B]">marketplace</span><br />
            awaits.
          </h2>
          <p className="text-base text-white/50 font-light italic leading-relaxed max-w-sm border-l-2 border-white/10 pl-6">
            Shop from verified sellers across Kigali's best markets. Fast delivery, secure MoMo payments, real-time tracking.
          </p>
        </div>

        {/* Trust badges */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-10 border-t border-white/10">
          {[
            { icon: '🛡️', label: 'Verified Sellers' },
            { icon: '🔒', label: 'Secure MoMo' },
            { icon: '🛵', label: 'Fast Delivery' },
          ].map(b => (
            <div key={b.label} className="text-center space-y-2">
              <div className="text-2xl">{b.icon}</div>
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-tight">{b.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Form Panel ── */}
      <div className="flex-1 bg-white flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md space-y-10 animate-reveal">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-serif font-black tracking-tighter text-[#121212]">RMF</span>
            <div className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full" />
          </div>

          {/* Header */}
          <div>
            <h1 className="text-4xl font-serif text-[#121212] italic tracking-tighter mb-2">Sign In</h1>
            <p className="text-sm text-[#6B665E]">
              New to RMF?{' '}
              <Link href="/register" className="text-[#A34D15] font-black hover:underline">Create a free account →</Link>
            </p>
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogleAuth}
            className="w-full flex items-center justify-center gap-4 py-4 border-2 border-[#E5E1D8] hover:border-[#121212] transition-all text-sm font-bold text-[#121212] group"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-[#F0EDE4]" />
            <span className="text-[10px] font-black text-[#6B665E] uppercase tracking-widest">or sign in with email</span>
            <div className="h-px flex-1 bg-[#F0EDE4]" />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#F8F6F1] border-2 border-[#E5E1D8] focus:border-[#121212] px-5 py-4 text-sm outline-none transition-colors rounded-none font-medium"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-[#121212] uppercase tracking-[0.4em] block" htmlFor="password">
                  Password
                </label>
                <button type="button" className="text-[10px] font-black text-[#A34D15] uppercase tracking-widest hover:underline">
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#F8F6F1] border-2 border-[#E5E1D8] focus:border-[#121212] px-5 py-4 text-sm outline-none transition-colors rounded-none font-medium pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B665E] hover:text-[#121212] transition-colors"
                >
                  {showPw ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#121212] text-white py-5 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#A34D15] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In →'}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-[10px] font-bold text-[#6B665E] uppercase tracking-widest pt-4 border-t border-[#F0EDE4]">
            Want to sell on RMF?{' '}
            <Link href="/register?role=SELLER" className="text-[#A34D15] font-black hover:underline">Apply as Seller</Link>
          </p>

        </div>
      </div>
    </div>
  );
}
