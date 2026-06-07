'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Clock } from 'lucide-react';

interface GroupBuyCardProps {
  groupBuy: {
    _id: string;
    productId?: any;
    discountPercent: number;
    targetQty: number;
    currentQty: number;
    deadline: string;
    status: string;
    productName?: string;
  };
}

function timeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.floor(ms / 60000)}m left`;
}

export const GroupBuyCard = ({ groupBuy }: GroupBuyCardProps) => {
  const pct = Math.min(100, Math.round((groupBuy.currentQty / Math.max(1, groupBuy.targetQty)) * 100));
  return (
    <Link
      href={`/group-buys/${groupBuy._id}`}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-[#e05300]"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#FFE9D6] px-2 py-0.5 text-[11px] font-bold text-[#7A3E00]">
          {groupBuy.discountPercent}% off
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <Clock size={12} /> {timeLeft(groupBuy.deadline)}
        </span>
      </div>
      <h3 className="line-clamp-2 text-sm font-bold text-gray-900">{groupBuy.productName || 'Group buy'}</h3>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><Users size={12} /> {groupBuy.currentQty}/{groupBuy.targetQty}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#e05300]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
};

export default GroupBuyCard;
