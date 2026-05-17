'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Globe2, LockKeyhole, Mail, MessageSquareText, RotateCcw, Send, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { notificationApi, userApi } from '@/lib/api';

type SettingsState = {
  language: 'en' | 'fr' | 'kin';
  currency: string;
  notifications: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    securityAlerts: boolean;
    customMessagesEmailOnly: boolean;
  };
  privacy: {
    showProfilePhoto: boolean;
    sharePhoneWithOrderParties: boolean;
  };
  seller: {
    autoReplyEnabled: boolean;
    autoReplyMessage: string;
    quoteExpiryHours: number;
  };
  rider: {
    autoAcceptNearby: boolean;
    maxPickupDistanceKm: number;
  };
};

const defaults: SettingsState = {
  language: 'en',
  currency: 'RWF',
  notifications: {
    inApp: true,
    email: true,
    sms: false,
    whatsapp: false,
    orderUpdates: true,
    promotions: false,
    securityAlerts: true,
    customMessagesEmailOnly: false,
  },
  privacy: {
    showProfilePhoto: true,
    sharePhoneWithOrderParties: true,
  },
  seller: {
    autoReplyEnabled: false,
    autoReplyMessage: '',
    quoteExpiryHours: 24,
  },
  rider: {
    autoAcceptNearby: false,
    maxPickupDistanceKm: 8,
  },
};

const mergeSettings = (incoming: Partial<SettingsState> | null): SettingsState => ({
  ...defaults,
  ...(incoming || {}),
  notifications: { ...defaults.notifications, ...(incoming?.notifications || {}) },
  privacy: { ...defaults.privacy, ...(incoming?.privacy || {}) },
  seller: { ...defaults.seller, ...(incoming?.seller || {}) },
  rider: { ...defaults.rider, ...(incoming?.rider || {}) },
});

const persistClientPreferences = (settings: SettingsState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('rmf_preferences', JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('rmf:preferences-updated', { detail: settings }));
};

const Toggle = ({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) => (
  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-[#e0e0e0] bg-white p-4 transition hover:border-[#1b4332]">
    <span>
      <span className="block text-sm font-black text-[#1b1c1c]">{label}</span>
      <span className="mt-1 block text-xs font-semibold leading-5 text-[#5f7569]">{description}</span>
    </span>
    <input type="checkbox" className="sr-only" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#1b4332]' : 'bg-[#dce4df]'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? 'left-6' : 'left-1'}`} />
    </span>
  </label>
);

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const { setLanguage } = useLanguage();
  const [settings, setSettings] = useState<SettingsState>(defaults);
  const [savedSettings, setSavedSettings] = useState<SettingsState>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [isLoading, user]);

  useEffect(() => {
    if (!user) {
      if (!isLoading) setLoading(false);
      return;
    }
    userApi.get('/users/settings')
      .then(res => {
        const nextSettings = mergeSettings(res.data?.data || null);
        setSettings(nextSettings);
        setSavedSettings(nextSettings);
        setLanguage(nextSettings.language);
        persistClientPreferences(nextSettings);
      })
      .catch((error: any) => {
        if (error?.response?.status !== 401) {
          toast.error('Settings could not be loaded. Showing safe defaults.');
        }
        setSettings(defaults);
        setSavedSettings(defaults);
      })
      .finally(() => setLoading(false));
  }, [isLoading, setLanguage, user]);

  const canUseSellerSettings = user?.role === 'SELLER' || user?.role === 'ADMIN';
  const canUseRiderSettings = user?.role === 'RIDER' || user?.role === 'ADMIN';

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(current => ({ ...current, [key]: value }));
    if (key === 'language') setLanguage(value as SettingsState['language']);
  };

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const notificationRows = useMemo(() => [
    ['inApp', 'In-app notifications', 'Show order, message, delivery, and security alerts in RMF.'],
    ['email', 'Email notifications', 'Send important marketplace updates to your email address.'],
    ['customMessagesEmailOnly', 'Custom messages only by email', 'Route custom buyer or seller messages to email instead of push-style alerts.'],
    ['sms', 'SMS alerts', 'Use phone alerts for urgent order and delivery updates.'],
    ['whatsapp', 'WhatsApp alerts', 'Use WhatsApp for buyer, seller, and delivery coordination.'],
    ['orderUpdates', 'Order updates', 'Notify me when quotes, payments, pickups, or deliveries change.'],
    ['promotions', 'Promotions', 'Receive campaign, flash sale, and marketplace deal updates.'],
    ['securityAlerts', 'Security alerts', 'Always notify me about sign-ins, profile changes, and payment risk.'],
  ] as const, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await userApi.put('/users/settings', settings);
      const nextSettings = mergeSettings(res.data?.data || settings);
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setLanguage(nextSettings.language);
      persistClientPreferences(nextSettings);
      toast.success('Settings saved');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(savedSettings);
    setLanguage(savedSettings.language);
    toast('Unsaved changes reset');
  };

  const sendTestNotification = async () => {
    if (!user?.id) {
      toast.error('Sign in to test notifications');
      return;
    }

    setTesting(true);
    try {
      const response = await notificationApi.post('/notifications/in-app', {
        userId: user.id,
        type: 'settings.test',
        params: {
          referenceId: user.id,
          referenceType: 'Settings',
        },
      });
      const data = response.data?.data;
      if (data?.skipped) {
        toast(`Test skipped: ${data.reason}`);
      } else {
        toast.success('Test alert sent');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not send test alert');
    } finally {
      setTesting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#c1ecd4] border-t-[#1b4332]" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#1b4332] text-white">
            <LockKeyhole size={22} />
          </div>
          <h1 className="text-3xl font-black text-[#1b1c1c]">Sign in to manage settings</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#5f7569]">
            Settings are tied to your RMF account so notification, privacy, seller, and rider preferences can follow you across market portals.
          </p>
          <a href="/login" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#1b4332] px-6 text-sm font-black text-white">
            Sign in
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 pb-20">
        <section className="overflow-hidden rounded-lg border border-[#d8ded9] bg-[#012d1d] p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#c1ecd4]">
                <SlidersHorizontal size={14} />
                Account controls
              </div>
              <h1 className="text-3xl font-black tracking-normal md:text-4xl">Settings</h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/70">
                Manage language, notifications, privacy, and role-specific workflows across RMF.
              </p>
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || !isDirty}
              className="inline-flex h-11 items-center justify-center rounded-md bg-[#c1ecd4] px-6 text-sm font-black text-[#012d1d] transition hover:bg-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : isDirty ? 'Save settings' : 'Saved'}
            </button>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-5">
            <section className="rounded-lg border border-[#e0e0e0] bg-[#fcf9f8] p-5">
              <div className="mb-4 flex items-center gap-3">
                <Globe2 className="text-[#1b4332]" size={20} />
                <h2 className="text-xl font-black text-[#1b1c1c]">Language and money</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-[#405046]">Current language</span>
                  <select
                    value={settings.language}
                    onChange={event => update('language', event.target.value as SettingsState['language'])}
                    className="h-11 w-full rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold outline-none focus:border-[#1b4332]"
                  >
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="kin">Kinyarwanda</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-[#405046]">Currency</span>
                  <select
                    value={settings.currency}
                    onChange={event => update('currency', event.target.value)}
                    className="h-11 w-full rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold outline-none focus:border-[#1b4332]"
                  >
                    <option value="RWF">RWF</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-[#e0e0e0] bg-[#fcf9f8] p-5">
              <div className="mb-4 flex items-center gap-3">
                <Bell className="text-[#1b4332]" size={20} />
                <h2 className="text-xl font-black text-[#1b1c1c]">Notifications</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {notificationRows.map(([key, label, description]) => (
                  <Toggle
                    key={key}
                    checked={settings.notifications[key]}
                    label={label}
                    description={description}
                    onChange={value => update('notifications', { ...settings.notifications, [key]: value })}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-[#e0e0e0] bg-[#fcf9f8] p-5">
              <div className="mb-4 flex items-center gap-3">
                <LockKeyhole className="text-[#1b4332]" size={20} />
                <h2 className="text-xl font-black text-[#1b1c1c]">Privacy</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Toggle
                  checked={settings.privacy.showProfilePhoto}
                  label="Show profile photo"
                  description="Display your photo on order, seller, rider, and support surfaces."
                  onChange={value => update('privacy', { ...settings.privacy, showProfilePhoto: value })}
                />
                <Toggle
                  checked={settings.privacy.sharePhoneWithOrderParties}
                  label="Share phone for active orders"
                  description="Let sellers, riders, or buyers see your number only when an order requires coordination."
                  onChange={value => update('privacy', { ...settings.privacy, sharePhoneWithOrderParties: value })}
                />
              </div>
            </section>

            {canUseSellerSettings && (
              <section className="rounded-lg border border-[#e0e0e0] bg-[#fcf9f8] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <MessageSquareText className="text-[#1b4332]" size={20} />
                  <h2 className="text-xl font-black text-[#1b1c1c]">Seller messaging</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle
                    checked={settings.seller.autoReplyEnabled}
                    label="Auto reply while busy"
                    description="Send a saved response when customers message outside your preferred hours."
                    onChange={value => update('seller', { ...settings.seller, autoReplyEnabled: value })}
                  />
                  <label className="block rounded-md border border-[#e0e0e0] bg-white p-4">
                    <span className="block text-sm font-black text-[#1b1c1c]">Quote expiry</span>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={settings.seller.quoteExpiryHours}
                      onChange={event => update('seller', { ...settings.seller, quoteExpiryHours: Number(event.target.value) })}
                      className="mt-2 h-10 w-full rounded-md border border-[#d9e0db] px-3 text-sm font-bold outline-none focus:border-[#1b4332]"
                    />
                  </label>
                </div>
                <textarea
                  value={settings.seller.autoReplyMessage}
                  onChange={event => update('seller', { ...settings.seller, autoReplyMessage: event.target.value })}
                  placeholder="Example: Thanks for your message. I will confirm availability shortly."
                  className="mt-3 min-h-24 w-full rounded-md border border-[#d9e0db] bg-white p-3 text-sm font-semibold outline-none focus:border-[#1b4332]"
                />
              </section>
            )}
          </main>

          <aside className="space-y-5">
            <section className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
              <ShieldCheck className="text-[#1b4332]" size={24} />
              <h2 className="mt-3 text-lg font-black text-[#1b1c1c]">Secure by default</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#5f7569]">
                Security alerts stay available even when promotional messages are off.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetSettings}
                  disabled={!isDirty}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d9e0db] px-3 text-xs font-black text-[#405046] transition hover:border-[#1b4332] hover:text-[#1b4332] disabled:opacity-50"
                >
                  <RotateCcw size={15} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={sendTestNotification}
                  disabled={testing || !settings.notifications.inApp}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1b4332] px-3 text-xs font-black text-white transition hover:bg-[#012d1d] disabled:opacity-50"
                >
                  <Send size={15} />
                  {testing ? 'Sending...' : 'Test alert'}
                </button>
              </div>
              {!settings.notifications.inApp && (
                <p className="mt-3 rounded-md bg-[#f7faf8] p-3 text-xs font-semibold leading-5 text-[#5f7569]">
                  Test alerts are unavailable while in-app notifications are off.
                </p>
              )}
            </section>

            <section className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
              <Mail className="text-[#1b4332]" size={24} />
              <h2 className="mt-3 text-lg font-black text-[#1b1c1c]">Message routing</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#5f7569]">
                Email-only custom messages keeps negotiation notes out of push alerts while preserving auditability.
              </p>
            </section>

            {canUseRiderSettings && (
              <section className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-[#1b1c1c]">Rider preferences</h2>
                <div className="mt-4 space-y-3">
                  <Toggle
                    checked={settings.rider.autoAcceptNearby}
                    label="Auto accept nearby"
                    description="Prepare future rider automation for jobs inside your preferred distance."
                    onChange={value => update('rider', { ...settings.rider, autoAcceptNearby: value })}
                  />
                  <label className="block">
                    <span className="mb-2 block text-xs font-black text-[#405046]">Max pickup distance</span>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={settings.rider.maxPickupDistanceKm}
                      onChange={event => update('rider', { ...settings.rider, maxPickupDistanceKm: Number(event.target.value) })}
                      className="h-11 w-full rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold outline-none focus:border-[#1b4332]"
                    />
                  </label>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}
