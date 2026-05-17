// Custom Service Worker Message Handler
// This extends the auto-generated service worker from next-pwa

// Listen for SKIP_WAITING message from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Received SKIP_WAITING message, activating new service worker...');
    self.skipWaiting();
  }
});

