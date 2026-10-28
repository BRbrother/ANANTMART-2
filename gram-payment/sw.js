"use strict";

const NOTIFICATION_TITLE = "Gram Payment";
const FALLBACK_URL = "./";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "New Payment Submitted",
    body: "Gram Mart mein ek payment verification ke liye aayi hai.",
    url: "./"
  };

  if (event.data) {
    try {
      const incoming = event.data.json();

      payload = {
        ...payload,
        ...incoming
      };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  // Only allow navigation to this panel's own origin.
  let targetUrl = FALLBACK_URL;

  try {
    const parsed = new URL(payload.url || FALLBACK_URL, self.location.origin);

    if (parsed.origin === self.location.origin) {
      targetUrl = parsed.href;
    }
  } catch {
    targetUrl = FALLBACK_URL;
  }

  const title = String(payload.title || NOTIFICATION_TITLE).slice(0, 100);
  const body = String(
    payload.body || "A payment needs review."
  ).slice(0, 250);

  const options = {
    body,
    icon: "../favicon.ico",
    badge: "../favicon.ico",
    tag: "gram-payment-new-payment",
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || FALLBACK_URL;

  event.waitUntil(
    (async () => {
      let destination;

      try {
        destination = new URL(targetUrl, self.location.origin);

        if (destination.origin !== self.location.origin) {
          destination = new URL(FALLBACK_URL, self.location.origin);
        }
      } catch {
        destination = new URL(FALLBACK_URL, self.location.origin);
      }

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          await client.navigate(destination.href);
          return;
        }
      }

      await self.clients.openWindow(destination.href);
    })()
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Subscription renewal needs server-side handling.
  // Re-enable alerts in the Gram Payment panel if notifications stop.
});