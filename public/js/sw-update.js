// sw-update.js: Service worker registration and force update logic for burger menu

// Register the service worker (if not already registered)
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        // Optionally listen for updates
      }).catch(err => {
        // Registration failed
        // eslint-disable-next-line no-console
        console.warn('Service worker registration failed:', err);
      });
    });
  }
}

// Returns a promise that resolves true if an update was found and applied
export async function forceUpdateServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  // Try to update
  await reg.update();
  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Wait for controllerchange
    return new Promise(resolve => {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
        resolve(true);
      }, { once: true });
    });
  } else if (reg.active && !reg.waiting) {
    // No update found
    return false;
  }
}
