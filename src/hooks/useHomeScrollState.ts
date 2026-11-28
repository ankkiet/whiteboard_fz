import { useCallback, useEffect, useRef, useState } from 'react';

export type HomeSectionId =
  | 'local-draft-section'
  | 'board-templates-section'
  | 'local-boards-section'
  | 'drive-boards-section';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tracks native window scroll progress, header elevation, active home chapter,
 * and back-to-top visibility without triggering per-frame React re-renders for the progress bar.
 */
export function useHomeScrollState(sectionIds: readonly HomeSectionId[]) {
  const [activeSection, setActiveSection] = useState<HomeSectionId>(
    sectionIds[0] ?? 'local-draft-section'
  );
  const [isScrolled, setIsScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const sectionIdsRef = useRef(sectionIds);
  sectionIdsRef.current = sectionIds;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let rafId = 0;

    const measure = () => {
      rafId = 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const docEl = document.documentElement;
      const maxScroll = Math.max(1, docEl.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, scrollY / maxScroll));

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      }

      const nextScrolled = scrollY > 12;
      setIsScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));

      const nextShowTop = scrollY > 420;
      setShowBackToTop((prev) => (prev === nextShowTop ? prev : nextShowTop));

      const ids = sectionIdsRef.current;
      if (!ids.length) return;

      // Clamp to final chapter when near bottom so short footer/Drive bands highlight reliably.
      if (scrollY + window.innerHeight >= docEl.scrollHeight - 24) {
        const lastId = ids[ids.length - 1];
        setActiveSection((prev) => (prev === lastId ? prev : lastId));
        return;
      }

      const anchorY = 140;
      let currentId = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= anchorY) {
          currentId = id;
        }
      }

      setActiveSection((prev) => (prev === currentId ? prev : currentId));
    };

    const scheduleMeasure = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, []);

  const scrollToSection = useCallback((id: HomeSectionId) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const el = document.getElementById(id);
    if (!el) return;
    const headerOffset = 72;
    const targetTop = Math.max(0, window.scrollY + el.getBoundingClientRect().top - headerOffset);
    window.scrollTo({
      top: targetTop,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, []);

  const scrollToTop = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, []);

  return {
    activeSection,
    isScrolled,
    showBackToTop,
    progressBarRef,
    scrollToSection,
    scrollToTop,
  };
}

/**
 * One-shot IntersectionObserver reveal hook for below-the-fold sections.
 * Falls back immediately to visible under reduced motion or unsupported environments.
 */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (isRevealed) return;
    const el = ref.current;
    if (!el || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsRevealed(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      setIsRevealed(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsRevealed(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }
    );

    io.observe(el);

    // Safety fallback so content can never remain stuck invisible on fast jumps
    const fallbackTimer = window.setTimeout(() => {
      setIsRevealed(true);
    }, 1800);

    return () => {
      io.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, [isRevealed]);

  return { ref, isRevealed };
}
