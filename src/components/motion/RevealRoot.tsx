'use client';

import { useEffect } from 'react';

/**
 * Scroll reveals for the whole application, from one observer.
 *
 * Server components mark what should arrive on scroll with `data-reveal`
 * (the element itself) or `data-reveal="stagger"` (its children, one after
 * another). Nothing else ships to the client: no wrapper component per
 * section, no animation library, and CSS does the moving — transform and
 * opacity only, so it composites on the GPU.
 *
 * Content is never at the mercy of this script. The inline guard in the
 * document head only hides reveal targets once it knows JavaScript runs, and
 * releases them on a timer if this component never arrives.
 */
const SELECTOR = '[data-reveal]';
/** Past this many siblings the stagger stops growing, so a long list never makes anyone wait. */
const MAX_STAGGER = 8;

export function RevealRoot() {
  useEffect(() => {
    const root = document.documentElement;
    (window as Window & { __zRevealReady?: boolean }).__zRevealReady = true;

    const index = (el: Element) => {
      if (el.getAttribute('data-reveal') !== 'stagger') return;
      Array.from(el.children).forEach((child, i) => {
        (child as HTMLElement).style.setProperty('--i', String(Math.min(i, MAX_STAGGER)));
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', 'true');
          // Revealed once; scrolling back up does not replay it.
          observer.unobserve(entry.target);
        }
      },
      // Trigger a little before the element is fully on screen, so it is
      // already moving as the eye reaches it.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    const watch = (el: Element) => {
      if (el.getAttribute('data-revealed') === 'true') return;
      index(el);
      observer.observe(el);
    };

    document.querySelectorAll(SELECTOR).forEach(watch);

    // Client navigation brings in new sections without a reload.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) watch(node);
          node.querySelectorAll(SELECTOR).forEach(watch);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    root.setAttribute('data-reveal-ready', 'true');
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return null;
}

/**
 * Runs before first paint. Turns reveals on only when JavaScript is present
 * and motion is welcome, and turns them back off if the observer has not
 * started within 2.5 seconds — a script error must never leave a page blank.
 */
export const REVEAL_GUARD = `(function(){try{var d=document.documentElement;if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.setAttribute('data-reveal-on','');setTimeout(function(){if(!window.__zRevealReady)d.removeAttribute('data-reveal-on')},2500)}catch(e){}})();`;
