'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { notificationApi } from '@/lib/api';
import { sanitizeText } from '@/lib/sanitize';

interface NotificationItem {
  _id: string;
  content: string;
  channel?: string;
  isRead?: boolean;
  createdAt?: string;
  type?: string;
}

type ReadFilter = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [filter, setFilter] = useState<ReadFilter>('all');

  // Auth guard: notifications are personal — require a signed-in user.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login?redirect=/notifications');
    }
  }, [isLoading, user, router]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.get('/notifications/me'),
        notificationApi.get('/notifications/unread-count'),
      ]);
      if (listRes.data?.success) {
        const logs = (Array.isArray(listRes.data.data) ? listRes.data.data : []) as NotificationItem[];
        setNotifications(logs.filter(log => log.channel === 'IN_APP'));
      }
      if (countRes.data?.success) {
        // GET /notifications/unread-count returns { success, count } — count is at the root.
        setUnreadCount(Number(countRes.data?.count ?? 0));
      }
    } catch {
      toast.error('Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchNotifications();
  }, [user?.id, fetchNotifications]);

  const markRead = async (id: string) => {
    // Optimistic update with rollback on failure.
    const prev = notifications;
    setNotifications(curr => curr.map(n => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      // userId is derived from the JWT server-side; no body needed.
      await notificationApi.put(`/notifications/read/${id}`);
    } catch {
      setNotifications(prev);
      setUnreadCount(c => c + 1);
      toast.error('Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setMarking(true);
    const prev = notifications;
    const prevCount = unreadCount;
    setNotifications(curr => curr.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationApi.put('/notifications/read-all');
      toast.success('All notifications marked as read');
    } catch {
      setNotifications(prev);
      setUnreadCount(prevCount);
      toast.error('Failed to mark all as read');
    } finally {
      setMarking(false);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.isRead);
    if (filter === 'read') return notifications.filter(n => n.isRead);
    return notifications;
  }, [notifications, filter]);

  const filters: { key: ReadFilter; label: string }[] = [
    { key: 'all', label: `All (${notifications.length})` },
    { key: 'unread', label: `Unread (${unreadCount})` },
    { key: 'read', label: `Read (${notifications.length - unreadCount})` },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 animate-reveal pb-20">
        {/* Header */}
        <section className="overflow-hidden rounded-lg border border-[#d8ded9] bg-[#e05300] p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffedd5]">
                <Bell size={14} />
                Notification center
              </div>
              <h1 className="text-3xl font-black tracking-normal md:text-4xl">Notifications</h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/70">
                {unreadCount > 0 ? `You have ${unreadCount} unread update${unreadCount === 1 ? '' : 's'}.` : 'You are all caught up.'}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={marking || unreadCount === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#ffedd5] px-6 text-sm font-black text-[#e05300] transition hover:bg-white disabled:opacity-60"
            >
              <CheckCheck size={16} />
              {marking ? 'Marking…' : 'Mark all read'}
            </button>
          </div>
        </section>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 rounded-lg border border-[#e0e0e0] bg-white p-3 shadow-sm">
          {filters.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                filter === f.key
                  ? 'bg-[#e05300] text-white'
                  : 'bg-[#fcf9f8] text-[#405046] hover:text-[#ff6b00]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <section className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-sm">
          {loading ? (
            <div className="divide-y divide-[#f0eded]">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-5">
                  <div className="h-12 animate-pulse rounded-md bg-[#f0eded]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
              <Inbox className="mb-4 text-[#ff6b00]/50" size={44} />
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5f7569]">
                {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#8b938d]">Marketplace updates will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0eded]">
              {filtered.map(notif => (
                <div
                  key={notif._id}
                  className={`flex cursor-pointer gap-4 p-5 transition-colors hover:bg-[#fcf9f8] ${!notif.isRead ? 'bg-[#ffedd5]/40' : ''}`}
                  onClick={() => !notif.isRead && markRead(notif._id)}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-[#ff6b00] text-white">
                    <Bell size={17} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm leading-6 ${!notif.isRead ? 'font-bold text-[#1b1c1c]' : 'text-[#414844]'}`}>
                      {sanitizeText(notif.content || '')}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <p className="text-xs font-semibold text-[#717973]">
                        {new Date(notif.createdAt || Date.now()).toLocaleString()}
                      </p>
                      {!notif.isRead && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#ff6b00]">
                          <span className="h-2 w-2 rounded-full bg-[#ffd700]" />
                          New
                        </span>
                      )}
                    </div>
                  </div>
                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(notif._id);
                      }}
                      className="self-center rounded-md border border-[#d9e0db] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-[#405046] transition hover:border-[#ff6b00] hover:text-[#ff6b00]"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
