"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// A thin accent-coloured progress bar pinned to the top of the viewport, shown
// while a client-side navigation is in flight. The App Router exposes no router
// events, so we detect a navigation *start* by intercepting in-app link clicks
// (and back/forward), and detect *completion* when the resolved URL actually
// changes. Dependency-free on purpose (the app avoids extra packages).
function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams}`;

  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const [fading, setFading] = useState(false);

  // Mirror of `active` for the URL-change effect, which must read the latest
  // value without re-subscribing on every state change.
  const activeRef = useRef(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (trickle.current) clearInterval(trickle.current);
    if (safety.current) clearTimeout(safety.current);
    if (hide.current) clearTimeout(hide.current);
    trickle.current = safety.current = hide.current = null;
  }, []);

  // Snap to 100%, fade out, then reset. No-op when the bar was never shown, so
  // programmatic navigations (a redirect with no link click) don't flash it.
  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();
    setWidth(100);
    setFading(true);
    hide.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
      setFading(false);
    }, 300);
  }, [clearTimers]);

  // Reveal the bar and creep it toward 90% (it never reaches 100 until the
  // navigation actually lands — classic "indeterminate" feel).
  const start = useCallback(() => {
    clearTimers();
    activeRef.current = true;
    setFading(false);
    setActive(true);
    setWidth(8);
    trickle.current = setInterval(() => {
      setWidth((w) => (w >= 90 ? w : w + Math.max(0.4, (90 - w) * 0.08)));
    }, 180);
    safety.current = setTimeout(finish, 12_000); // never hang forever
  }, [clearTimers, finish]);

  // Navigation completed → the resolved URL changed. Skip the initial mount.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    finish();
  }, [url, finish]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      let dest: URL;
      try {
        dest = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return; // external link
      if (dest.href === window.location.href) return; // same page, no nav
      start();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      clearTimers();
    };
  }, [start, clearTimers]);

  if (!active && width === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-accent shadow-[0_0_8px_var(--color-accent)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: fading ? 0 : 1 }}
      />
    </div>
  );
}

export function TopProgressBar() {
  // `useSearchParams` must sit under a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
