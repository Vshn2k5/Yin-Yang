import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface ScrollPosition {
  x: number;
  y: number;
}

// LRU cache for scroll positions to prevent memory leaks
const MAX_STORED_POSITIONS = 50;
const scrollPositions = new Map<string, ScrollPosition>();

function addScrollPosition(key: string, position: ScrollPosition): void {
  // If key exists, delete it first to update its position in the LRU order
  if (scrollPositions.has(key)) {
    scrollPositions.delete(key);
  }
  
  // If at capacity, remove the oldest entry
  if (scrollPositions.size >= MAX_STORED_POSITIONS) {
    const firstKey = scrollPositions.keys().next().value;
    if (firstKey) {
      scrollPositions.delete(firstKey);
    }
  }
  
  scrollPositions.set(key, position);
}

export const useScrollPosition = () => {
  const location = useLocation();
  const [isRestoring, setIsRestoring] = useState(false);

  // Save scroll position when leaving a page
  useEffect(() => {
    const saveScrollPosition = () => {
      addScrollPosition(location.pathname, {
        x: window.scrollX,
        y: window.scrollY
      });
    };

    // Save position before page unload
    window.addEventListener('beforeunload', saveScrollPosition);
    
    return () => {
      saveScrollPosition();
      window.removeEventListener('beforeunload', saveScrollPosition);
    };
  }, [location.pathname]);

  // Restore scroll position when entering a page
  useEffect(() => {
    const restoreScrollPosition = () => {
      const savedPosition = scrollPositions.get(location.pathname);
      
      if (savedPosition) {
        setIsRestoring(true);
        
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          window.scrollTo({
            left: savedPosition.x,
            top: savedPosition.y,
            behavior: 'auto' // Instant restore
          });
          
          setTimeout(() => setIsRestoring(false), 100);
        });
      } else {
        // New page, scroll to top
        window.scrollTo(0, 0);
      }
    };

    // Small delay to allow page transition to complete
    const timer = setTimeout(restoreScrollPosition, 50);
    
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return { isRestoring };
};