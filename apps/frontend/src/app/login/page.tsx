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
        toast.success(t('success'));

        // Role-based redirection
        if (user.role === 'SELLER') router.push('/seller/dashboard');
        else if (user.role === 'RIDER') router.push('/rider/dashboard');
        else if (user.role === 'ADMIN') router.push('/admin');
        else router.push('/');
      } else {
        toast.error(res.data?.error || t('error'));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_USER_SERVICE_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-[#F8F6F1] font-sans selection:bg-[#A34D15] selection:text-white flex items-center justify-center p-6 md:p-12">
      <div className="max-w-7xl w-full flex flex-col lg:flex-row items-stretch justify-center animate-reveal">
        {/* Institutional Identity Panel */}
        <div className="hidden lg:flex w-1/2 bg-[#121212] text-white p-20 flex-col justify-between border-2 border-[#121212] relative overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(163,77,21,0.2),transparent_70%)]"></div>
             <div className="text-[200px] font-serif italic absolute -bottom-10 -right-10 leading-none select-none opacity-10">RMF</div>
          </div>
          
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-baseline gap-1 mb-20 group/logo">
              <span className="text-5xl font-serif font-black tracking-tighter text-white group-hover/logo:text-[#A34D15] transition-colors">RMF</span>
              <div className="w-2 h-2 bg-[#A34D15] rounded-full"></div>
            </Link>
            
            <div className="flex items-center gap-6 mb-12">
               <div className="w-12 h-px bg-[#A34D15]"></div>
               <p className="text-[11px] font-black text-[#A34D15] uppercase tracking-[0.5em]">{t('auth_identity_portal')}</p>
            </div>
            <h2 className="text-7xl font-serif tracking-tighter italic leading-none mb-12 text-white">
              {t('auth_access_core').split('<br/>').map((line, i) => (
                <React.Fragment key={i}>{line}{i === 0 && <br/>}</React.Fragment>
              ))}
            </h2>
            <p className="text-xl text-white/70 font-light italic leading-relaxed max-w-sm border-l-2 border-white/20 pl-10">
               {t('auth_core_desc')}
            </p>
          </div>

          <div className="relative z-10 pt-12 border-t border-white/20 flex justify-between items-end">
             <div>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/60 mb-2">{t('auth_system_status')}</p>
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-white/90">{t('auth_gateway_nominal')}</span>
                </div>
             </div>
             <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.6em]">Ver: 2.4.0-STABLE</p>
          </div>
        </div>

        {/* Elite Authentication Workstation */}
        <div className="w-full lg:w-1/2 bg-white border-2 border-[#121212] lg:border-l-0 p-12 md:p-24 flex flex-col justify-center shadow-2xl">
          <div className="mb-16">
            <h1 className="text-5xl font-serif text-[#121212] tracking-tighter italic mb-4">{t('login_title')}</h1>
            <p className="text-[11px] font-black text-[#6B665E] uppercase tracking-[0.4em] opacity-60">{t('login_subtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-12">
            <div className="rmf-form-group">
              <label className="rmf-label" htmlFor="email">
                {t('email_label')}
                <span className="opacity-40">{t('auth_required')}</span>
              </label>
              <input
                id="email" 
                type="email" 
                required
                className="rmf-input"
                placeholder={t('auth_secure_email')} 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="rmf-form-group">
              <label className="rmf-label" htmlFor="password">
                {t('password_label')}
                <span className="opacity-40">{t('auth_secure_mask')}</span>
              </label>
              <input
                id="password" 
                type="password" 
                required
                className="rmf-input"
                placeholder="••••••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="pt-6">
              <button 
                type="submit" 
                disabled={isLoading}
                className="rmf-btn-primary w-full group relative"
              >
                <span className="relative z-10">{isLoading ? t('signing_in') : t('sign_in')}</span>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-40 group-hover:translate-x-2 transition-transform">→</div>
              </button>
            </div>
          </form>

          <div className="mt-12 flex items-center gap-6">
            <div className="h-px flex-grow bg-[#F0EDE4]"></div>
            <span className="text-[9px] font-black text-[#6B665E] uppercase tracking-[0.3em] opacity-60">{t('auth_external_protocols')}</span>
            <div className="h-px flex-grow bg-[#F0EDE4]"></div>
          </div>

          <button
            onClick={handleGoogleAuth}
            className="mt-12 w-full flex items-center justify-center gap-6 py-5 border-2 border-[#F0EDE4] hover:border-[#121212] transition-all text-[11px] font-black uppercase tracking-[0.3em] group"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all opacity-80 group-hover:opacity-100" />
            <span className="text-[#121212]/80 group-hover:text-[#121212]">{t('continue_google')}</span>
          </button>

          <div className="mt-20 pt-10 border-t border-[#F0EDE4] text-center">
            <p className="text-[10px] font-black text-[#6B665E] uppercase tracking-[0.3em]">
              {t('login_no_account')} 
              <Link href="/register" className="text-[#A34D15] ml-4 border-b-2 border-[#A34D15]/40 hover:border-[#A34D15] transition-all">
                {t('login_register')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
