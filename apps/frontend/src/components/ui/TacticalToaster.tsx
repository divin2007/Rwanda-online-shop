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
        className={`relative z-[9999] bg-[#121212] text-white border-2 border-[#F59E0B] p-6 shadow-[10px_10px_0px_0px_#121212] flex items-center gap-4 min-w-[300px] pointer-events-auto`}
      >
        <div className={`w-2 h-2 rounded-full animate-pulse ${t.type === 'error' ? 'bg-red-500' : 'bg-[#F59E0B]'}`}></div>
        <div className="flex-grow">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
            {t.message as React.ReactNode}
          </p>
        </div>
        <button 
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => toast.dismiss(t.id), 300);
          }}
          className="text-[8px] font-black uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export const TacticalToaster = () => {
  const { toasts, handlers } = useToaster();

  return (
    <div className="fixed top-24 right-10 z-[9999] pointer-events-none flex flex-col items-end max-w-md w-full">
      {toasts.map((t) => (
        <SwipeableToast key={t.id} t={t} />
      ))}
    </div>
  );
};
