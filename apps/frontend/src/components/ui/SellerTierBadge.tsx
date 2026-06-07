'use client';

import React from 'react';
import { Shield, Star, Trophy } from 'lucide-react';

type Tier = 'BRONZE' | 'SILVER' | 'GOLD';

interface SellerTierBadgeProps {
  tier?: Tier;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const TIER_CONFIG: Record<Tier, { label: string; bg: string; fg: string; Icon: typeof Shield }> = {
  BRONZE: { label: 'Bronze', bg: '#F0E0D2', fg: '#7A4A24', Icon: Shield },
  SILVER: { label: 'Silver', bg: '#E5E7EB', fg: '#4B5563', Icon: Star },
  GOLD: { label: 'Gold', bg: '#FCEFC2', fg: '#8A6A00', Icon: Trophy },
};

/**
 * Seller certification tier pill (Feature 11). Tier is computed weekly by the admin
 * tier-calculation job from order volume, rating and dispute rate.
 */
export const SellerTierBadge = ({ tier, size = 'sm', className = '' }: SellerTierBadgeProps) => {
  if (!tier || !TIER_CONFIG[tier]) return null;
  const { label, bg, fg, Icon } = TIER_CONFIG[tier];
  const iconSize = size === 'xs' ? 9 : size === 'sm' ? 11 : 13;
  const textSize = size === 'xs' ? 'text-[9px]' : size === 'sm' ? 'text-[10px]' : 'text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-full px-2 py-0.5 font-label-caps shadow-sm ${textSize} ${className}`}
      style={{ backgroundColor: bg, color: fg }}
      title={`${label} certified seller`}
    >
      <Icon size={iconSize} />
      {label}
    </span>
  );
};

export default SellerTierBadge;
