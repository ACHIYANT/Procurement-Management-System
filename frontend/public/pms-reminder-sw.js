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
  const options = {
    body: payload.body || "Open My Work for details.",
    tag: `pms-work-push-${payload.taskId || Date.now()}`,
    renotify: true,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: {
      taskId: payload.taskId || null,
      url: payload.url || "/my-work",
      reminderSound: payload.reminderSound || "soft_bell",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
