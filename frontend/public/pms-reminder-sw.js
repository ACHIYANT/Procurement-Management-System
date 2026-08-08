self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/my-work";
  const destinationUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            if ("navigate" in client) {
              return client.navigate(destinationUrl).then((focusedClient) => {
                if (focusedClient && "focus" in focusedClient) {
                  return focusedClient.focus();
                }
                return client.focus();
              });
            }
            return client.focus();
          }
        }

        return self.clients.openWindow(destinationUrl);
      }),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() || {};
  const title = payload.title || "Work reminder";
  const isCritical = payload.priority === "critical" || payload.severity === "critical";
  const options = {
    body: payload.body || "Open My Work for details.",
    tag: `pms-work-push-${payload.taskId || Date.now()}`,
    renotify: true,
    requireInteraction: isCritical,
    silent: payload.reminderSound === "silent",
    timestamp: Date.now(),
    vibrate: [180, 90, 180],
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: {
      taskId: payload.taskId || null,
      url: payload.url || "/my-work",
      reminderSound: payload.reminderSound || "soft_bell",
    },
  };

  const notifyOpenClients = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "work-reminder-push",
          task: {
            id: payload.taskId || null,
            title,
            description: payload.description || "",
            due_at: payload.dueAt || null,
            reminder_at: payload.reminderAt || null,
            priority: payload.priority || "medium",
            severity: payload.severity || "normal",
            linked_reference: payload.linkedReference || "",
            linked_url: payload.url || "/my-work",
          },
        });
      });
    });

  event.waitUntil(Promise.all([self.registration.showNotification(title, options), notifyOpenClients]));
});
