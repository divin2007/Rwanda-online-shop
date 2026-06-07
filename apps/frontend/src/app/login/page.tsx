'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Store, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { userApi } from '@/lib/api';
import { getSafeRedirect } from '@/lib/safeRedirect';

type ApiError = { response?: { data?: { error?: string; message?: string } } };

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, isLoading: authLoading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  const routeForRole = React.useCallback((role?: string) => {
    if (role === 'SELLER') return '/seller/dashboard';
    if (role === 'RIDER') return '/rider/dashboard';
    if (role === 'ADMIN') return '/admin';
    return '/dashboard';
  }, []);

  const routeAfterLogin = React.useCallback(async (role?: string) => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const redirectUrl = params.get('redirect');
      if (redirectUrl) return getSafeRedirect(redirectUrl, '/dashboard');
    }
    if (role === 'SELLER') return '/seller/dashboard';
    if (role === 'RIDER') return '/rider/dashboard';
    if (role === 'ADMIN') return '/admin';
    if (role !== 'BUYER') return routeForRole(role);
    try {
      const res = await userApi.get('/users/preferences/discovery');
      return res.data?.data?.onboardingCompleted ? '/dashboard' : '/preferences';
    } catch {
      return '/dashboard';
    }
  }, [routeForRole]);

  useEffect(() => {
    if (!authLoading && user) {
      const params = new URLSearchParams(window.location.search);
      const redirectUrl = params.get('redirect');
      if (redirectUrl) {
        router.replace(getSafeRedirect(redirectUrl, routeForRole(user.role)));
      } else {
        router.replace(routeForRole(user.role));
      }
    }
  }, [authLoading, routeForRole, router, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const directToken = params.get('token');
    const directRefresh = params.get('refreshToken');

    let token: string | null = null;
    let refreshToken: string | null = null;

    if (code) {
      try {
        const decoded = JSON.parse(Buffer.from(code, 'base64url').toString());
        if (Date.now() - decoded.ts > 30_000) {
          toast.error('Sign-in link expired. Please try again.');
          window.history.replaceState({}, '', '/login');
          return;
        }
        token = decoded.accessToken;
        refreshToken = decoded.refreshToken;
      } catch {
        toast.error('Invalid sign-in code. Please try again.');
        window.history.replaceState({}, '', '/login');
        return;
      }
    } else if (directToken) {
      token = directToken;
      refreshToken = directRefresh;
    }

    if (!token) return;

    window.history.replaceState({}, '', '/login');

    userApi.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.data?.success) {
          login(res.data.data, token!, refreshToken || undefined);
          router.replace(await routeAfterLogin(res.data.data.role));
        }
      })
      .catch(() => toast.error('Google sign-in failed. Please try again.'));
  }, [login, routeAfterLogin, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await userApi.post('/auth/login', { email, password });
      if (res.data?.success) {
        const { accessToken, refreshToken, user } = res.data.data;
        login(user, accessToken, refreshToken);
        toast.success('Welcome back!');
        router.push(await routeAfterLogin(user.role));
      } else {
        toast.error(res.data?.error || 'Login failed');
      }
    } catch (error: unknown) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.error || apiError.response?.data?.message || 'Incorrect email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    const baseUrl = process.env.NEXT_PUBLIC_USER_SERVICE_URL || 'http://localhost:3001';
    window.location.href = `${baseUrl}/auth/google`;
  };

  return (
    <div className="flex min-h-screen bg-[#fdfaf7] font-sans selection:bg-[#ff6b00] selection:text-white relative">
      {/* Floating Language Switcher in top right corner */}
      <div className="absolute right-4 top-4 z-50 flex h-9 items-center gap-1 rounded-md border border-[#ebdcd0] bg-white/90 backdrop-blur px-1.5 shadow-sm">
        <span className="rounded bg-[#ffedd5] px-2 py-0.5 text-[9px] font-black uppercase text-[#ff6b00]">
          {language.toUpperCase()}
        </span>
        {(['en', 'fr', 'kin'] as const).map((lang, index) => (
          <React.Fragment key={lang}>
            <button
              type="button"
              onClick={() => setLanguage(lang)}
              title={lang === 'en' ? 'English' : lang === 'fr' ? 'French' : 'Kinyarwanda'}
              className={`rounded px-1.5 py-1 text-xs font-black uppercase transition ${
                language === lang ? 'bg-[#ffedd5] text-[#ff6b00]' : 'text-[#405046] hover:text-[#ff6b00]'
              }`}
            >
              {lang}
            </button>
            {index < 2 && <span className="text-xs font-black text-[#d2bca8]">/</span>}
          </React.Fragment>
        ))}
      </div>

      <div
        className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#e05300] p-16 text-white lg:flex"
        style={{
          backgroundImage: 'linear-gradient(90deg, rgba(224,83,0,0.96), rgba(255,107,0,0.78)), url("https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=80&w=1400")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute -bottom-8 -right-8 select-none text-[220px] font-black leading-none text-white/5">RMF</div>

        <div className="relative z-10">
          <Link href="/" className="group inline-flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-normal text-white transition-colors group-hover:text-[#ffedd5]">RMF</span>
            <div className="h-2 w-2 rounded-full bg-[#ffedd5]" />
          </Link>
          <p className="mt-2 text-[9px] font-black uppercase tracking-[0.5em] text-white/50">{t('site_name')}</p>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="h-px w-8 bg-[#ffedd5]" />
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#ffedd5]">{t('login_title')}</p>
          </div>
          <h2 className="text-6xl font-black leading-[0.95] tracking-normal text-white whitespace-pre-line">
            {language === 'kin' ? 'Amasoko meza\nyo mu Rwanda,\nyakugezweho.' : language === 'fr' ? 'Marchés locaux,\nlivrés chez vous.' : 'Trusted local\nmarkets,\ndelivered.'}
          </h2>
          <p className="max-w-sm border-l-2 border-white/15 pl-6 text-base leading-relaxed text-white/75">
            {t('home_hero_desc')}
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4 border-t border-white/15 pt-10">
          {[
            { icon: ShieldCheck, label: t('trust_point_2_title') },
            { icon: LockKeyhole, label: t('secure_payments_title') },
            { icon: Truck, label: t('trust_point_3_title') },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="space-y-2 text-center">
              <Icon className="mx-auto text-[#ffedd5]" size={22} />
              <p className="text-[8px] font-black uppercase leading-tight tracking-widest text-white/65">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-5 md:p-12">
        <div className="w-full max-w-md space-y-9 animate-reveal">
          <div className="mb-4 flex items-baseline gap-2 lg:hidden">
            <span className="text-3xl font-black tracking-normal text-[#1b1c1c]">RMF</span>
            <div className="h-1.5 w-1.5 rounded-full bg-[#ffedd5]" />
          </div>

          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#ffedd5] px-3 py-1.5 text-xs font-black text-[#ff6b00]">
              <Store size={15} />
              {t('official_facilitator')}
            </div>
            <h1 className="mb-2 text-4xl font-black tracking-normal text-[#1b1c1c]">{t('login_signin')}</h1>
            <p className="text-sm text-[#414844]">
              {t('login_no_account')}{' '}
              <Link href="/register" className="font-black text-[#ff6b00] hover:underline">{t('login_register')} -&gt;</Link>
            </p>
          </div>

          <button
            onClick={handleGoogleAuth}
            className="flex w-full items-center justify-center gap-4 rounded-lg border border-[#d9e0db] bg-white py-4 text-sm font-bold text-[#1b1c1c] transition-all hover:border-[#ff6b00]"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-5 w-5" />
            {t('login_google')}
          </button>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-[#e0e0e0]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#5f7569]">{t('auth_external_protocols') || 'or sign in with email'}</span>
            <div className="h-px flex-1 bg-[#e0e0e0]" />
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]" htmlFor="email">
                {t('login_email')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-md border border-[#d9e0db] bg-white px-5 py-4 text-sm font-medium outline-none transition-colors focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ffedd5]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-[#1b1c1c]" htmlFor="password">
                  {t('login_password')}
                </label>
                <button type="button" className="text-[10px] font-black uppercase tracking-widest text-[#ff6b00] hover:underline">
                  {language === 'kin' ? 'Wagiranye ijambo ry\'ibanga?' : language === 'fr' ? 'Mot de passe oublié ?' : 'Forgot Password?'}
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="********"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-md border border-[#d9e0db] bg-white px-5 py-4 pr-14 text-sm font-medium outline-none transition-colors focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ffedd5]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#414844] transition-colors hover:text-[#1b1c1c]"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-md bg-[#e05300] py-5 text-[11px] font-black uppercase tracking-[0.3em] text-white transition-all hover:bg-[#ff6b00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t('login_signing_in')}
                </>
              ) : `${t('login_signin')} ->`}
            </button>
          </form>

          <p className="border-t border-[#e0e0e0] pt-4 text-center text-[10px] font-bold uppercase tracking-widest text-[#414844]">
            {language === 'kin' ? 'Nshaka gucururiza kuri RMF?' : language === 'fr' ? 'Vous voulez vendre sur RMF ?' : 'Want to sell on RMF?'}{' '}
            <Link href="/register?role=SELLER" className="font-black text-[#ff6b00] hover:underline">
              {t('become_seller')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
