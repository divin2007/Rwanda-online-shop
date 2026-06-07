'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Search, ShieldCheck, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { userApi } from '@/lib/api';
import { sanitizeText } from '@/lib/sanitize';

type Role = 'BUYER' | 'SELLER' | 'RIDER' | 'ADMIN';
const ROLES: Role[] = ['BUYER', 'SELLER', 'RIDER', 'ADMIN'];

interface UserRecord {
  _id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: Role | string;
  isActive?: boolean;
  status?: string;
  createdAt?: string;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

export default function AdminUsersPage() {
  const { user: admin } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UserRecord | null>(null);
  const [searched, setSearched] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role | ''>('');
  const [saving, setSaving] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = query.trim();
    if (!OBJECT_ID.test(id)) {
      toast.error('Enter a valid 24-character user ID');
      return;
    }
    setLoading(true);
    setSearched(true);
    setResult(null);
    try {
      const res = await userApi.get(`/users/${id}`);
      if (res.data?.success && res.data.data) {
        setResult(res.data.data);
        setPendingRole((res.data.data.role as Role) || '');
      } else {
        setResult(null);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        toast.error('No user found with that ID');
      } else {
        toast.error(err?.response?.data?.message || 'Lookup failed');
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async () => {
    if (!result || !pendingRole || pendingRole === result.role) return;
    if (result._id === admin?.id) {
      toast.error('You cannot change your own role.');
      return;
    }
    setSaving(true);
    try {
      await userApi.put(`/users/${result._id}/role`, { role: pendingRole });
      toast.success(`Role updated to ${pendingRole}`);
      setResult({ ...result, role: pendingRole });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update role');
      setPendingRole((result.role as Role) || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-6 animate-reveal pb-20">
        <div className="border-b border-[#e0e0e0] pb-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ff6b00]">Admin · Users</p>
            <Link href="/admin?tab=analytics" className="text-[10px] font-black uppercase tracking-widest text-[#5f7569] hover:text-[#ff6b00]">
              ← Admin portal
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-4xl font-sans tracking-normal text-[#1b1c1c]">
            <UserCog className="text-[#ff6b00]" size={32} />
            User Management
          </h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-[#414844]">
            Look up a user by their ID and manage their platform role.
          </p>
        </div>

        {/* Note: no bulk-list endpoint exists in user-service yet. */}
        <div className="flex items-start gap-3 rounded-lg border border-[#ffe0c2] bg-[#fff7ed] p-4">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#b45309]" />
          <p className="text-xs font-semibold leading-5 text-[#92400e]">
            Bulk user listing requires a backend <code className="rounded bg-white/70 px-1 font-mono">GET /users</code> endpoint, which is not yet
            available. This tool looks up a single user by ID and changes their role via the existing endpoints.
          </p>
        </div>

        {/* Lookup */}
        <form onSubmit={lookup} className="rounded-lg border border-[#e0e0e0] bg-white p-5 shadow-sm">
          <label className="mb-2 block text-xs font-black uppercase tracking-widest text-[#405046]">User ID</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b938d]" size={16} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. 65f1a2b3c4d5e6f7a8b9c0d1"
                className="h-11 w-full rounded-md border border-[#d9e0db] bg-white pl-11 pr-4 font-mono text-sm outline-none transition focus:border-[#ff6b00]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center rounded-md bg-[#e05300] px-6 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#ff6b00] disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Look up'}
            </button>
          </div>
        </form>

        {/* Result */}
        {searched && !loading && !result && (
          <div className="rounded-lg border-2 border-dashed border-[#e0e0e0] bg-white px-4 py-12 text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5f7569]">No user found</p>
            <p className="mt-2 text-xs font-semibold text-[#8b938d]">Check the ID and try again.</p>
          </div>
        )}

        {result && (
          <section className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-sm">
            <div className="border-b border-[#e0e0e0] bg-[#fcf9f8] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#1b1c1c]">{sanitizeText(result.fullName || 'Unnamed user')}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#5f7569]">{sanitizeText(result.email || '—')}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#ffedd5] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#e05300]">
                  <ShieldCheck size={13} />
                  {String(result.role || 'unknown').toLowerCase()}
                </span>
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="User ID" value={result._id} mono />
              <Field label="Phone" value={result.phone || '—'} />
              <Field label="Status" value={result.isActive === false ? 'Inactive' : result.status || 'Active'} />
              <Field label="Joined" value={result.createdAt ? new Date(result.createdAt).toLocaleDateString() : '—'} />
            </div>

            {/* Role change */}
            <div className="border-t border-[#e0e0e0] bg-[#fcf9f8] p-6">
              <label className="mb-3 block text-xs font-black uppercase tracking-widest text-[#405046]">Change role</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={pendingRole}
                  onChange={e => setPendingRole(e.target.value as Role)}
                  className="h-11 rounded-md border border-[#d9e0db] bg-white px-3 text-sm font-bold outline-none focus:border-[#ff6b00] sm:w-56"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={changeRole}
                  disabled={saving || !pendingRole || pendingRole === result.role || result._id === admin?.id}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[#e05300] px-6 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#ff6b00] disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Update role'}
                </button>
              </div>
              {result._id === admin?.id && (
                <p className="mt-3 text-xs font-semibold text-[#7b3f3f]">You cannot change your own role.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-widest text-[#414844]/60">{label}</p>
    <p className={`mt-1 text-sm font-bold text-[#1b1c1c] ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</p>
  </div>
);
