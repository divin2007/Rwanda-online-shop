'use client';
import React, { useState, useEffect } from 'react';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
}

export const StarRating = ({ rating, onRatingChange, readonly = false }: StarRatingProps) => {
  const [hover, setHover] = useState(0);

  // MD5 fix: reset hover highlight when the component becomes read-only
  // (e.g. after a user submits a rating and the prop flips from false → true)
  useEffect(() => {
    if (readonly) setHover(0);
  }, [readonly]);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`text-2xl transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} ${
            star <= (hover || rating) ? 'text-status-warning' : 'text-border'
          }`}
          onClick={() => onRatingChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          ★
        </button>
      ))}
    </div>
  );
};
