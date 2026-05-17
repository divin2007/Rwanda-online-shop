'use client';
import React, { useState, useEffect, useRef } from 'react';
import toast, { useToaster, Toast } from 'react-hot-toast';

const SwipeableToast = ({ t }: { t: Toast }) => {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!t.visible && !isExiting) {
      setIsExiting(true);
    }
  }, [t.visible, isExiting]);

  const handleStart = (clientX: number) => {
    if (isExiting) return;
    setStartX(clientX);
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (startX === null || isExiting) return;
    const diff = clientX - startX;
    if (diff > 0) setCurrentX(diff);
  };

  const handleEnd = () => {
    if (startX === null) return;
    if (currentX > 150) {
      setIsExiting(true);
      setTimeout(() => toast.dismiss(t.id), 300);
    } else {
      setCurrentX(0);
    }
    setStartX(null);
    setIsDragging(false);
  };

  const opacity = isExiting ? 0 : Math.max(0, 1 - currentX / 300);
  const rotate = (currentX / 300) * 10;
  const scale = isExiting ? 0.95 : 1;
  const translateX = isExiting ? currentX + 500 : currentX;

  return (
    <div
      className="transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden"
      style={{
        maxHeight: isExiting ? '0px' : '200px',
        marginBottom: isExiting ? '0px' : '1rem',
        opacity: isExiting ? 0 : 1,
      }}
    >
      <div
        ref={toastRef}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => isDragging && handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
        style={{
          transform: `translateX(${translateX}px) rotate(${rotate}deg) scale(${scale})`,
          opacity,
          transition: isDragging ? 'none' : 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        className="relative z-[9999] flex min-w-[300px] items-center gap-4 rounded-lg border border-[#d9e0db] bg-white p-4 text-[#1b1c1c] shadow-xl pointer-events-auto"
      >
        <div className={`h-9 w-1.5 rounded-full ${t.type === 'error' ? 'bg-[#574e47]' : 'bg-[#d9560b]'}`}></div>
        <div className="flex-grow">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#d9560b]">
            {t.type === 'error' ? 'Needs attention' : 'RMF update'}
          </p>
          <p className="text-sm font-bold leading-snug text-[#1b1c1c]">
            {t.message as React.ReactNode}
          </p>
        </div>
        <button 
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => toast.dismiss(t.id), 300);
          }}
          className="rounded-md border border-[#d9e0db] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#574e47] transition hover:border-[#d9560b] hover:text-[#d9560b]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export const TacticalToaster = () => {
  const { toasts } = useToaster();

  return (
    <div className="fixed right-4 top-20 z-[9999] pointer-events-none flex w-[calc(100%-2rem)] max-w-md flex-col items-end sm:right-6">
      {toasts.map((t) => (
        <SwipeableToast key={t.id} t={t} />
      ))}
    </div>
  );
};
