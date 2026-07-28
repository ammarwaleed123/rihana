import {
  PORTAL_ACTIVE_KEY,
  PORTAL_LOCK_MS,
  PORTAL_WARM_KEY,
} from "@/lib/pwa/portal-lock";

/**
 * Pre-paint half of the auto-lock.
 *
 * Runs as a blocking inline script *while the HTML is still parsing* — before
 * the signed-in page is painted — so a cold reopen (or a session left idle past
 * `idleMs`) goes straight to the sign-in page with no flash of the account
 * behind it. Without this, the lock decision only ran in <SessionLock/>'s effect
 * (after hydration and first paint), which is why the account appeared for a
 * moment before the redirect.
 *
 * It reads the exact same markers as the runtime half and must stay in step with
 * it (see portal-lock.ts): WARM in sessionStorage (cleared by the browser on
 * close → its absence means a cold reopen) and ACTIVE in localStorage (the idle
 * clock). On any storage error it fails open — never locks a legitimate user out
 * — and it is skipped under automation so the e2e suite is not signed out
 * between its hard navigations.
 *
 * Placed as the first child of the signed-in layout so it executes before the
 * header (which prints the user's name) and the page body are parsed. The
 * runtime half, <SessionLock/>, still handles idle-while-open and
 * return-from-background once the app is on screen.
 */
export function SessionLockBoot({ idleMs = PORTAL_LOCK_MS }: { idleMs?: number }) {
  const script = [
    "(function(){try{",
    "if(navigator.webdriver)return;",
    `var w;try{w=sessionStorage.getItem(${JSON.stringify(PORTAL_WARM_KEY)})==="1";}catch(e){return;}`,
    `var l=0;try{l=Number(localStorage.getItem(${JSON.stringify(PORTAL_ACTIVE_KEY)})||0);}catch(e){return;}`,
    `var idle=l>0&&(Date.now()-l)>${idleMs};`,
    "if(w&&!idle)return;",
    "if(window.__rihanaLocking)return;window.__rihanaLocking=1;",
    // Paint the canvas paper and hide the body's content (not the whole
    // document), so the split-second before /signin loads is an on-brand cream
    // frame rather than the black default webview background.
    'document.documentElement.style.backgroundColor="#FFF9EF";',
    'if(document.body){document.body.style.visibility="hidden";}else{document.documentElement.style.visibility="hidden";}',
    'try{if(navigator.sendBeacon)navigator.sendBeacon("/api/lock");}catch(e){}',
    'location.replace("/signin?next="+encodeURIComponent(location.pathname+location.search));',
    "}catch(e){}})();",
  ].join("");

  // Inline, synchronous, and deliberately before paint — this is the whole point
  // of the component, so the no-danger lint would be a false positive here.
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
