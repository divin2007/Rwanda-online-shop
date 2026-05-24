'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { sellerApi } from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ShieldCheck, Clock } from 'lucide-react';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const redirectForRole = (role?: string) => {
    if (role === 'ADMIN') return '/admin';
    if (role === 'RIDER') return '/rider/dashboard';
    if (role === 'BUYER') return '/dashboard';
    return '/';
  };

  useEffect(() => {
    if (user?.id && user.role === 'SELLER') {
      setProfileLoading(true);
      sellerApi.get('/sellers/me')
        .then(res => {
          if (res.data?.success) {
            setProfile(res.data.data);
          } else {
            setProfile(null);
          }
        })
        .catch(() => setProfile(null))
        .finally(() => setProfileLoading(false));
    } else if (!isLoading && user?.role !== 'SELLER') {
      setProfile(null);
      setProfileLoading(false);
    } else if (!isLoading && !user) {
      setProfileLoading(false);
    }
  }, [user?.id, isLoading, user]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace(`/login?redirect=${pathname}`);
      } else if (user.role !== 'SELLER') {
        router.replace(redirectForRole(user.role));
      } else if (!profileLoading && profile === null && !pathname.includes('/onboarding')) {
        router.replace('/seller/onboarding');
      }
    }
  }, [user, isLoading, router, profile, profileLoading, pathname]);

  if (isLoading || profileLoading || !user || user.role !== 'SELLER') {
    return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  }

  if (profile && !profile.isApproved && !pathname.includes('/onboarding')) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center p-12 animate-reveal">
          <div className="max-w-2xl w-full bg-white border border-[#e0e0e0] rounded-lg p-16 shadow-2xl">
            <div className="h-2 bg-[#ffedd5] -mx-16 -mt-16 mb-16" />
            <div className="text-center space-y-4 mb-12">
              <p className="text-[11px] font-black text-[#ff6b00] uppercase tracking-[0.22em]">Status: Under Review</p>
              <h1 className="text-3xl font-sans tracking-normal text-[#1b1c1c]">Application Received!</h1>
            </div>
            <div className="space-y-6 bg-[#fcf9f8] p-5 border border-[#e0e0e0] mb-10">
              {[
                { icon: <ShieldCheck size={20} className="text-white" />, title: 'Verification in Progress', desc: "We're checking your business documents. This ensures all RMF sellers meet our quality standards." },
                { icon: <Clock size={20} className="text-white" />, title: 'Timeline: Up to 24 hours', desc: "You'll receive a notification once your shop is live and ready to accept orders." },
              ].map(item => (
                <div key={item.title} className="flex gap-6">
                  <div className="w-12 h-12 bg-[#e05300] flex items-center justify-center flex-shrink-0">{item.icon}</div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#1b1c1c] mb-1">{item.title}</h4>
                    <p className="text-xs text-[#414844] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-[#414844] uppercase tracking-widest mb-6">Shop: {profile.shopDetails?.name || 'Your Shop'}</p>
              <div className="flex justify-center gap-4">
                <Link href="/" className="bg-[#e05300] text-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-[#ff6b00] transition-all inline-block">
                  Back to Homepage
                </Link>
                <button
                  onClick={() => {
                    setProfileLoading(true);
                    sellerApi.get(`/sellers/me?userId=${user.id}`)
                      .then(res => {
                        if (res.data?.success && res.data.data) {
                          const updatedProfile = res.data.data;
                          setProfile(updatedProfile);
                          if (updatedProfile.isApproved) {
                            toast.success('Your account is approved! Welcome.');
                            router.replace('/seller/dashboard');
                          } else {
                            toast.error('Your application is still under review.');
                          }
                        } else {
                          toast.error('Could not fetch updated status.');
                        }
                      })
                      .catch(() => toast.error('Could not fetch updated status.'))
                      .finally(() => setProfileLoading(false));
                  }}
                  className="bg-[#ffd700] text-black px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-[#cbb500] transition-all inline-block"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return <>{children}</>;
}
