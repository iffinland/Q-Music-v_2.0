import { useEffect, useRef, useState } from 'react';

export const useVisibilityTrigger = (options?: {
  rootMargin?: string;
  once?: boolean;
}) => {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = targetRef.current;
    if (!node) return;
    if (isVisible && options?.once !== false) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setIsVisible(true);
        if (options?.once !== false) {
          observer.disconnect();
        }
      },
      {
        rootMargin: options?.rootMargin ?? '240px',
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, options?.once, options?.rootMargin]);

  return { targetRef, isVisible, setIsVisible };
};
