import { useState, useRef, useEffect } from 'react';

type FullscreenHook = [
  React.RefObject<HTMLElement | null>, 
  () => void, 
  boolean
];

/**
 * Custom hook for handling fullscreen functionality
 * @returns [ref, toggleFullscreen, isFullscreen]
 * - ref: Reference to attach to the element you want to make fullscreen
 * - toggleFullscreen: Function to toggle fullscreen state
 * - isFullscreen: Boolean indicating if the element is currently fullscreen
 */
export function useFullscreen(): FullscreenHook {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  const toggleFullscreen = () => {
    if (!elementRef.current) return;

    if (!isFullscreen) {
      // Enter fullscreen
      if (elementRef.current.requestFullscreen) {
        elementRef.current.requestFullscreen()
          .catch(err => console.error(`Error attempting to enable fullscreen: ${err.message}`));
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .catch(err => console.error(`Error attempting to exit fullscreen: ${err.message}`));
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === elementRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return [elementRef, toggleFullscreen, isFullscreen];
} 