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
