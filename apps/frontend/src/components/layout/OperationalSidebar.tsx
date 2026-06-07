'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export type OperationalRole = 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';

export type OperationalNavItem = {
  label: string;
  icon: string;
  href: string;
  section: string;
};

const roleCopy: Record<OperationalRole, { title: string; subtitle: string; icon: string }> = {
  BUYER: { title: 'Market Facilitator', subtitle: 'Operational Hub', icon: 'storefront' },
  SELLER: { title: 'Market Facilitator', subtitle: 'Seller Station', icon: 'storefront' },
  RIDER: { title: 'Market Facilitator', subtitle: 'Rider Console', icon: 'two_wheeler' },
  ADMIN: { title: 'Market Facilitator', subtitle: 'Global Ops', icon: 'admin_panel_settings' },
};

const roleActions: Record<OperationalRole, { label: string; icon: string; href: string }> = {
  BUYER: { label: 'New Quote', icon: 'add', href: '/markets' },
  SELLER: { label: 'Add Product', icon: 'add', href: '/seller/products/new' },
  RIDER: { label: 'Delivery Queue', icon: 'local_shipping', href: '/rider/deliveries' },
  ADMIN: { label: 'Review Queue', icon: 'rule', href: '/admin?tab=approvals' },
};

const navByRole: Record<OperationalRole, OperationalNavItem[]> = {
  BUYER: [
    { label: 'Dashboard', icon: 'dashboard', href: '/dashboard', section: 'dashboard' },
    { label: 'Markets', icon: 'storefront', href: '/markets', section: 'markets' },
    { label: 'Products', icon: 'inventory_2', href: '/products', section: 'products' },
    { label: 'Riders', icon: 'two_wheeler', href: '/riders', section: 'riders' },
    { label: 'Orders', icon: 'shopping_cart', href: '/orders', section: 'orders' },
    { label: 'Disputes', icon: 'gavel', href: '/disputes', section: 'disputes' },
    { label: 'Messages', icon: 'chat', href: '/messages', section: 'messages' },
    { label: 'Wallet', icon: 'account_balance_wallet', href: '/wallet', section: 'wallet' },
    { label: 'Wishlist', icon: 'favorite', href: '/wishlist', section: 'wishlist' },
  ],
  SELLER: [
    { label: 'Dashboard', icon: 'dashboard', href: '/seller/dashboard', section: 'dashboard' },
    { label: 'Inventory', icon: 'inventory_2', href: '/seller/products', section: 'inventory' },
    { label: 'Menu', icon: 'restaurant_menu', href: '/seller/menu', section: 'menu' },
    { label: 'Orders', icon: 'shopping_cart', href: '/seller/orders', section: 'orders' },
    { label: 'Promotions', icon: 'sell', href: '/seller/promotions', section: 'promotions' },
    { label: 'Stories', icon: 'videocam', href: '/seller/videos', section: 'stories' },
    { label: 'Analytics', icon: 'bar_chart', href: '/seller/analytics', section: 'analytics' },
    { label: 'Earnings', icon: 'payments', href: '/seller/earnings', section: 'earnings' },
    { label: 'Reviews', icon: 'reviews', href: '/seller/reviews', section: 'reviews' },
    { label: 'QR Verify', icon: 'qr_code_scanner', href: '/seller/qr', section: 'qr' },
  ],
  RIDER: [
    { label: 'Dashboard', icon: 'dashboard', href: '/rider/dashboard', section: 'dashboard' },
    { label: 'Deliveries', icon: 'local_shipping', href: '/rider/deliveries', section: 'deliveries' },
    { label: 'Earnings', icon: 'payments', href: '/rider/earnings', section: 'earnings' },
    { label: 'Plan', icon: 'workspace_premium', href: '/rider/plan', section: 'plan' },
    { label: 'Setup', icon: 'tune', href: '/rider/setup', section: 'setup' },
  ],
  ADMIN: [
    { label: 'Control Center', icon: 'dashboard', href: '/admin', section: 'dashboard' },
    { label: 'Analytics', icon: 'bar_chart', href: '/admin?tab=analytics', section: 'analytics' },
    { label: 'Accounting', icon: 'payments', href: '/admin?tab=accounting', section: 'accounting' },
    { label: 'Live Ops', icon: 'map', href: '/admin?tab=live-map', section: 'live-map' },
    { label: 'Operations', icon: 'settings_suggest', href: '/admin?tab=operations', section: 'operations' },
    { label: 'Approvals', icon: 'rule', href: '/admin?tab=approvals', section: 'approvals' },
    { label: 'Disputes', icon: 'gavel', href: '/admin?tab=disputes', section: 'disputes' },
    { label: 'Support', icon: 'support_agent', href: '/admin/support', section: 'support' },
  ],
};

export const normalizeOperationalRole = (role?: string | null): OperationalRole => {
  if (role === 'SELLER' || role === 'RIDER' || role === 'ADMIN') return role;
  return 'BUYER';
};

export const getOperationalNavItems = (role?: string | null) => navByRole[normalizeOperationalRole(role)];

export const getOperationalAction = (role?: string | null) => roleActions[normalizeOperationalRole(role)];

export const getOperationalCopy = (role?: string | null) => roleCopy[normalizeOperationalRole(role)];

export const getOperationalHomeHref = (role?: string | null) => {
  const roleKey = normalizeOperationalRole(role);
  if (roleKey === 'SELLER') return '/seller/dashboard';
  if (roleKey === 'RIDER') return '/rider/dashboard';
  if (roleKey === 'ADMIN') return '/admin';
  return '/dashboard';
};

type OperationalSidebarProps = {
  role?: string | null;
  mobileOpen?: boolean;
  activeSection?: string;
  onLogout?: () => void;
  onNavigate?: () => void;
};

export const OperationalSidebar = ({
  role,
  mobileOpen = false,
  activeSection,
  onLogout,
  onNavigate,
}: OperationalSidebarProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [apexUrl, setApexUrl] = useState('');
  const roleKey = normalizeOperationalRole(role);
  const copy = roleCopy[roleKey];
  const action = roleActions[roleKey];
  const navItems = navByRole[roleKey];

  useEffect(() => {
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const isLocalhost = hostname === 'localhost' || hostname.endsWith('.localhost');
    const parts = hostname.split('.');
    const hasSubdomain = isLocalhost
      ? parts.length >= 2 && parts[parts.length - 1] === 'localhost'
      : parts.length >= 3 && parts[0] !== 'www';

    if (!hasSubdomain) {
      setApexUrl('');
      return;
    }

    setApexUrl(isLocalhost ? `${window.location.protocol}//localhost${port}` : `${window.location.protocol}//rwshop.org${port}`);
  }, []);

  const resolveHref = (href: string) => {
    if (!apexUrl || !href.startsWith('/')) return href;
    return `${apexUrl}${href}`;
  };

  const isActive = (item: OperationalNavItem) => {
    if (activeSection) return item.section === activeSection;

    if (item.href.includes('?')) {
      const [path, query] = item.href.split('?');
      const params = new URLSearchParams(query);
      const [key, value] = Array.from(params.entries())[0] || [];
      return pathname === path && key ? searchParams.get(key) === value : false;
    }

    if (pathname === item.href && searchParams.toString()) {
      const hasQuerySpecificSibling = navItems.some((other) => other.href.startsWith(`${item.href}?`) && isActive(other));
      if (hasQuerySpecificSibling) return false;
    }

    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const shellClass = mobileOpen
    ? 'flex absolute left-0 top-0 h-[calc(100vh-4rem)] bg-surface-container-low shadow-[20px_0_60px_rgba(27,28,28,0.16)] md:relative md:h-[calc(100vh-4rem)] md:shadow-none'
    : 'hidden md:flex';

  return (
    <nav className={`${shellClass} z-40 w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low`}>
      <div className="border-b border-outline-variant bg-surface-container p-gutter">
        <div className="mb-sm flex items-center gap-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest">
            <span className="material-symbols-outlined text-primary-container">{copy.icon}</span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-headline-md text-headline-md font-bold leading-tight text-on-surface">{copy.title}</h1>
            <p className="font-label-caps text-label-caps text-on-surface-variant">{copy.subtitle}</p>
          </div>
        </div>
        <Link
          href={resolveHref(action.href)}
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-xs rounded-lg bg-primary-container py-sm font-body-md font-semibold text-on-primary transition hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
          {action.label}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-sm">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={`${item.section}-${item.href}`}
              href={resolveHref(item.href)}
              onClick={onNavigate}
              className={`mx-2 flex items-center gap-sm rounded-lg px-4 py-3 transition-all duration-200 ${
                active
                  ? 'bg-primary-container font-bold text-on-primary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-label-caps text-label-caps">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-outline-variant bg-surface-container py-sm">
        <Link
          href={resolveHref('/settings')}
          onClick={onNavigate}
          className={`mx-2 flex items-center gap-sm rounded-lg px-4 py-3 transition hover:bg-surface-container-highest ${
            pathname === '/settings' ? 'bg-primary-container/10 font-bold text-primary' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-label-caps text-label-caps">Settings</span>
        </Link>
        <Link
          href={resolveHref(roleKey === 'ADMIN' ? '/admin/support' : '/contact')}
          onClick={onNavigate}
          className="mx-2 flex items-center gap-sm rounded-lg px-4 py-3 text-on-surface-variant transition hover:bg-surface-container-highest"
        >
          <span className="material-symbols-outlined">help</span>
          <span className="font-label-caps text-label-caps">Support</span>
        </Link>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="mx-2 flex w-[calc(100%-1rem)] items-center gap-sm rounded-lg px-4 py-3 text-left font-bold text-error transition hover:bg-error-container/20"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-label-caps text-label-caps">Log Out</span>
          </button>
        )}
      </div>
    </nav>
  );
};
