'use client';

import React from 'react';
import { Clock } from 'lucide-react';

interface PerishableBadgeProps {
  maxDeliveryMinutes?: number;
  className?: string;
}

/**
 * Cold-chain / perishable indicator (Feature 6). Shown on products and menu items
 * flagged perishable=true so buyers know the item has a delivery time window.
 */
export const PerishableBadge = ({ maxDeliveryMinutes, className = '' }: PerishableBadgeProps) => {
  const minutes = Number(maxDeliveryMinutes) > 0 ? Math.round(Number(maxDeliveryMinutes)) : null;
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-sm bg-warning-container px-2 py-0.5 font-label-caps text-[9px] text-on-warning-container shadow-sm ${className}`}
      style={{ backgroundColor: '#FFE2C4', color: '#7A3E00' }}
      title="Perishable — prioritized delivery"
    >
      <Clock size={10} />
      {minutes ? `Deliver within ${minutes}min` : 'Perishable'}
    </span>
  );
};

export default PerishableBadge;
