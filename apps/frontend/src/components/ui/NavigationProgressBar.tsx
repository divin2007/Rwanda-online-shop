'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    // When pathname or searchParams change, we complete the loading progress!
    if (active) {
      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setActive(false);
        const resetTimer = setTimeout(() => {
          setProgress(0);
        }, 300);
        return () => clearTimeout(resetTimer);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, active]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const startProgress = () => {
      setVisible(true);
      setActive(true);
      setProgress(10);
      
      if (interval) clearInterval(interval);
      
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          const increment = prev < 50 ? 8 : prev < 80 ? 4 : 1;
          return prev + increment;
        });
      }, 150);
    };

    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href) return;

      // Check if it's an internal link
      const isLocal = href.startsWith('/') || href.startsWith(window.location.origin);
      const isAnchor = href.includes('#') && href.split('#')[0] === window.location.pathname;
      const isTargetBlank = target.getAttribute('target') === '_blank';
      const isDownload = target.hasAttribute('download');
      
      if (
        isLocal && 
        !isAnchor && 
        !isTargetBlank && 
        !isDownload &&
        !e.defaultPrevented && 
        e.button === 0 && 
        !e.metaKey && 
        !e.ctrlKey && 
        !e.shiftKey && 
        !e.altKey
      ) {
        startProgress();
      }
    };

    // Listen to pushState / replaceState to catch programmatic router push
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      // Defer setState to the next macrotask — avoids calling setState
      // inside React's commit phase which triggers useInsertionEffect errors
      setTimeout(startProgress, 0);
      return originalPushState.apply(window.history, args);
    };

    window.history.replaceState = function(...args) {
      setTimeout(startProgress, 0);
      return originalReplaceState.apply(window.history, args);
    };

    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      if (interval) clearInterval(interval);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none">
      <div 
        className="h-[3px] bg-gradient-to-r from-[#ff6b00] to-[#ff8c3a] shadow-[0_0_8px_#ff6b00,0_0_4px_#ff8c3a] transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
