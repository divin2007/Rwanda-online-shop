'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { notificationApi } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import toast from 'react-hot-toast';

interface NotificationItem {
  _id: string;
  content: string;
  channel?: string;
  isRead?: boolean;
  createdAt?: string;
}

const readInAppPreference = () => {
  if (typeof window === 'undefined') return true;
  try {
    const stored = localStorage.getItem('rmf_preferences');
    if (!stored) return true;
    const parsed = JSON.parse(stored);
    return parsed?.notifications?.inApp !== false;
  } catch {
    return true;
  }
};

export const NotificationBell = ({ compact = false }: { compact?: boolean }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notificationSocketUrl = user?.id && inAppEnabled
    ? process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:3009'
    : '';

  // 2D fix: pass auth token to WebSocket for server-side validation
  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const { data: socketData } = useSocket<NotificationItem>(
    notificationSocketUrl,
    user?.id && inAppEnabled ? 'notification:new' : '',
    accessToken || undefined,
    user?.id && inAppEnabled ? { query: { userId: user.id } } : undefined
  );

  useEffect(() => {
    setInAppEnabled(readInAppPreference());
    const handlePreferenceUpdate = () => setInAppEnabled(readInAppPreference());
    window.addEventListener('rmf:preferences-updated', handlePreferenceUpdate);
    window.addEventListener('storage', handlePreferenceUpdate);
    return () => {
      window.removeEventListener('rmf:preferences-updated', handlePreferenceUpdate);
      window.removeEventListener('storage', handlePreferenceUpdate);
    };
  }, []);

  useEffect(() => {
    if (inAppEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [inAppEnabled]);

  useEffect(() => {
    if (socketData && inAppEnabled) {
      setNotifications(prev => [socketData, ...prev]);
      setUnreadCount(prev => prev + 1);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Rwanda Marketplace', {
          body: socketData.content,
          icon: '/favicon.ico',
        });
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      toast(t('notif_new'), { icon: '🔔' });
    }
  }, [inAppEnabled, socketData, t]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id || !inAppEnabled) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationApi.get('/notifications/me');
      if (res.data?.success) {
        const logs = (Array.isArray(res.data.data) ? res.data.data : []) as NotificationItem[];
        setNotifications(logs.filter(log => log.channel === 'IN_APP'));
        setUnreadCount(logs.filter(log => log.channel === 'IN_APP' && !log.isRead).length);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  }, [inAppEnabled, user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.put(`/notifications/read/${id}`, { userId: user?.id });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.put('/notifications/read-all', { userId: user?.id });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative inline-flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-white text-sm font-bold text-[#1b1c1c] transition hover:border-[#ff6b00] hover:text-[#ff6b00] ${
          compact ? 'h-9 w-9 justify-center px-0' : 'h-11 px-3'
        }`}
        aria-label="Notifications"
      >
        <Bell size={18} />
        <span className={compact ? 'sr-only' : 'hidden sm:inline'}>Alerts</span>
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full bg-[#ffd700] px-2 py-0.5 text-xs font-black text-[#1b1c1c] shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-3 right-3 top-20 z-[100] overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-2xl animate-fade-in sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[22rem]">
          <div className="flex items-center justify-between border-b border-[#e0e0e0] bg-[#fcf9f8] p-5">
            <div>
              <h3 className="text-sm font-black text-[#1b1c1c]">{t('notif_title')}</h3>
              <p className="mt-1 text-xs font-semibold text-[#414844]">{unreadCount} unread updates</p>
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-black text-[#ff6b00] hover:text-[#e05300]">
                {t('notif_mark_all_read')}
              </button>
            )}
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-12 text-center text-sm text-[#414844]">
                {inAppEnabled ? t('notif_empty') : 'In-app alerts are off in Settings.'}
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`relative flex cursor-pointer gap-4 border-b border-[#f0eded] p-5 transition-colors hover:bg-[#fcf9f8] ${!notif.isRead ? 'bg-[#ffedd5]/50' : ''}`}
                  onClick={() => !notif.isRead && handleMarkRead(notif._id)}
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[#ff6b00] text-white">
                    <Bell size={16} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm leading-6 ${!notif.isRead ? 'font-bold text-[#1b1c1c]' : 'text-[#414844]'}`}>
                      {notif.content}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#717973]">
                        {new Date(notif.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - marketplace update
                      </p>
                      {!notif.isRead && <div className="h-2 w-2 rounded-full bg-[#ffd700]" />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-[#fcf9f8] p-4 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-black text-[#ff6b00] transition hover:text-[#e05300]"
            >
              {t('notif_view_all')} -&gt;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
