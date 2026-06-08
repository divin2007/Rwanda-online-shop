'use client';

import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { orderApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Users, Clock } from 'lucide-react';

const ORDER_SOCKET_URL = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006';

export default function GroupBuyDetailPage({ params }: { params: Promise<{ groupBuyId: string }> }) {
  const { groupBuyId } = React.use(params);
  const { user } = useAuth();
  const [gb, setGb] = useState<any>(null);
  const [qty, setQty] = useState('1');
  const [joining, setJoining] = useState(false);

  const { data: joinEvent, emit, isConnected } = useSocket<any>(ORDER_SOCKET_URL, 'group_buy:participant_joined');
  const { data: lockEvent } = useSocket<any>(ORDER_SOCKET_URL, 'group_buy:locked');

  const load = () => orderApi.get(`/group-buys/${groupBuyId}`).then((res) => setGb(res.data?.data)).catch(() => {});

  useEffect(() => { load(); }, [groupBuyId]);
  useEffect(() => { if (isConnected) emit('join:group_buy', groupBuyId); }, [isConnected, groupBuyId, emit]);
  useEffect(() => { if (joinEvent?.currentQty != null) setGb((p: any) => (p ? { ...p, currentQty: joinEvent.currentQty } : p)); }, [joinEvent]);
  useEffect(() => { if (lockEvent) load(); }, [lockEvent]);

  const join = async () => {
    if (!user) return toast.error('Please log in to join');
    setJoining(true);
    try {
      await orderApi.post(`/group-buys/${groupBuyId}/join`, { qty: Number(qty) || 1 });
      toast.success('You joined this group buy!');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  if (!gb) {
    return <Layout><div className="mx-auto max-w-2xl px-4 py-16 text-center text-gray-500">Loading…</div></Layout>;
  }

  const pct = Math.min(100, Math.round((gb.currentQty / Math.max(1, gb.targetQty)) * 100));
  const ended = new Date(gb.deadline).getTime() <= Date.now();

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <span className="rounded-full bg-[#FFE9D6] px-3 py-1 text-sm font-bold text-[#7A3E00]">{gb.discountPercent}% off</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Group Buy</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <Clock size={14} /> Deadline: {new Date(gb.deadline).toLocaleString()} · <Users size={14} /> {gb.participantCount ?? gb.currentQty} joined
          </p>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-sm text-gray-500">
              <span>{gb.currentQty}/{gb.targetQty} units</span><span>{pct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[#e05300]" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <input
              type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
              className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={join}
              disabled={joining || ended || gb.status !== 'open'}
              className="flex-1 rounded bg-[#e05300] py-2.5 text-sm font-bold text-white hover:bg-[#c44800] disabled:opacity-50"
            >
              {gb.status !== 'open' ? `Group buy ${gb.status}` : ended ? 'Deadline passed' : joining ? 'Joining…' : 'Join Group Buy'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
