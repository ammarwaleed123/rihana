/*
 * Rihana service worker.
 *
 * Its whole job is proactive notifications: show a push as a notification, keep
 * the home-screen badge in sync, and open the right page when tapped. There is
 * deliberately no offline caching — the app exists to show a family's private
 * photos, which need a live, authorized connection; a stale cached shell would
 * be worse than a normal load. Installability comes from the manifest, not from
 * a cache.
 */

self.addEventListener("install", () => {
  // Take over as soon as installed rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler must exist for the browser to offer installation, even though
// we do no offline caching. This one is a deliberate no-op: it never calls
// respondWith, so every request falls through to the network untouched. Its only
// job is to make the app installable (the "Add to Home Screen" / install icon).
self.addEventListener("fetch", () => {
  // Intentionally empty — let the browser handle the request normally.
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Rihana", body: event.data.text() };
  }

  const title = payload.title || "Rihana Montessori Academy";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    data: { url: payload.url || "/portal" },
    vibrate: [80, 40, 80],
  };
  // renotify requires a tag; setting it without one throws.
  if (payload.tag) {
    options.tag = payload.tag;
    options.renotify = true;
  }

  const tasks = [self.registration.showNotification(title, options)];

  // WhatsApp-style unread count on the app icon. Guarded because iOS/Safari and
  // older Android lack the Badging API; where it is missing we skip it silently.
  if (typeof payload.badgeCount === "number" && "setAppBadge" in self.navigator) {
    tasks.push(
      payload.badgeCount > 0
        ? self.navigator.setAppBadge(payload.badgeCount)
        : self.navigator.clearAppBadge(),
    );
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/portal";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Reuse an open tab rather than stacking up new windows.
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});

// The page can ask the worker to clear the badge once everything has been read,
// so it clears even while the app is only backgrounded.
self.addEventListener("message", (event) => {
  if (event.data === "clear-badge" && "clearAppBadge" in self.navigator) {
    self.navigator.clearAppBadge();
  }
});
