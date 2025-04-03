import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom hook to manage fullscreen behavior for any HTML element
 * @returns [ref, toggleFullscreen, isFullscreen]
 */
export function useFullscreen<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T>,
  () => void,
  boolean
] {
  // Define ref with proper typing
  const ref = useRef<T>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!ref.current) return;

    if (!document.fullscreenElement) {
      ref.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  return [ref, toggleFullscreen, isFullscreen];
}