'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Layout } from '@/components/layout/Layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const redirectForRole = (role?: string) => {
    if (role === 'SELLER') return '/seller/dashboard';
    if (role === 'RIDER') return '/rider/dashboard';
    if (role === 'BUYER') return '/dashboard';
    return '/';
  };

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace(`/login?redirect=${pathname}`);
      } else if (user.role !== 'ADMIN') {
        router.replace(redirectForRole(user.role));
      }
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading || !user || user.role !== 'ADMIN') {
    return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  }

  return <>{children}</>;
}
