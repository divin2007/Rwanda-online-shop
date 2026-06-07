'use client';

import React from 'react';
import { CheckCircle2, HelpCircle } from 'lucide-react';

interface FreshnessBadgeProps {
  isCheckedIn?: boolean;
  checkedInAt?: string | Date | null;
  confirmedByRider?: boolean;
  className?: string;
}

function formatTime(value?: string | Date | null): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Verified-freshness indicator (Feature 12). Green when the food seller has checked
 * in for the day; grey when their status is unknown.
 */
export const FreshnessBadge = ({ isCheckedIn, checkedInAt, confirmedByRider, className = '' }: FreshnessBadgeProps) => {
  if (isCheckedIn) {
    const time = formatTime(checkedInAt);
    return (
      <span
        className={`inline-flex items-center gap-xs rounded-full px-2 py-0.5 font-label-caps text-[10px] shadow-sm ${className}`}
        style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
        title={confirmedByRider ? 'Open today — rider confirmed' : 'Checked in today'}
      >
        <CheckCircle2 size={11} />
        {time ? `Checked in today at ${time}` : 'Checked in today'}
        {confirmedByRider ? ' ✓' : ''}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-full px-2 py-0.5 font-label-caps text-[10px] shadow-sm ${className}`}
      style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
      title="Freshness status unknown"
    >
      <HelpCircle size={11} />
      Status unknown
    </span>
  );
};

export default FreshnessBadge;
