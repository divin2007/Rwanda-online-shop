'use client';

import React from 'react';

export type ProductCondition = 'new' | 'grade_a' | 'grade_b' | 'grade_c' | 'refurbished';

// Short label + buyer-facing description for each condition grade.
export const CONDITION_META: Record<ProductCondition, { label: string; description: string }> = {
  new: { label: 'New', description: 'Brand new, unused, in original packaging' },
  grade_a: { label: 'Grade A', description: 'Like new, no visible wear' },
  grade_b: { label: 'Grade B', description: 'Light wear, fully functional' },
  grade_c: { label: 'Grade C', description: 'Visible wear, works as expected' },
  refurbished: { label: 'Refurbished', description: 'Professionally restored and tested' },
};

const TONE: Record<ProductCondition, string> = {
  new: 'bg-primary/10 text-primary-container border-primary-container/20',
  grade_a: 'bg-primary/10 text-primary-container border-primary-container/20',
  grade_b: 'bg-surface-container-low text-on-surface-variant border-outline-variant',
  grade_c: 'bg-surface-container-low text-on-surface-variant border-outline-variant',
  refurbished: 'bg-secondary/10 text-secondary border-secondary/20',
};

export function ConditionBadge({
  condition,
  size = 'sm',
}: {
  condition?: ProductCondition | string | null;
  size?: 'xs' | 'sm';
}) {
  if (!condition || !(condition in CONDITION_META)) return null;
  const meta = CONDITION_META[condition as ProductCondition];
  const tone = TONE[condition as ProductCondition];
  const px = size === 'xs' ? 'px-2 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-full border font-label-caps ${px} ${tone} shadow-sm`}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}
