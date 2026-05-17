// sw-update.js: Service worker registration and force update logic for burger menu

// Register the service worker (if not already registered)
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('Service worker registered:', reg);
      }).catch(err => {
        console.error('Service worker registration failed:', err);
      });
    });
  }
}

// Returns a promise that resolves true if an update was found and applied
export async function forceUpdateServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }
  return false;
}
