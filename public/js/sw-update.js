// sw-update.js: Service worker registration and force update logic for burger menu

let awaitingControllerChangeReload = false;

function enableReloadOnControllerChange() {
  if (awaitingControllerChangeReload) {
    return;
  }

  awaitingControllerChangeReload = true;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  }, { once: true });
}

function waitForWaitingServiceWorker(registration, timeoutMs = 8000) {
  if (registration.waiting) {
    return Promise.resolve(registration.waiting);
  }

  if (!registration.installing) {
    return Promise.resolve(null);
  }

  const installing = registration.installing;
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      resolve(registration.waiting || null);
    }, timeoutMs);

    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') {
        clearTimeout(timeoutId);
        resolve(registration.waiting || installing);
        return;
      }

      if (installing.state === 'redundant') {
        clearTimeout(timeoutId);
        resolve(null);
      }
    });
  });
}

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
  enableReloadOnControllerChange();

  // Trigger a network check for a newer service worker script.
  try {
    await registration.update();
  } catch {
    // Ignore update-check errors and continue with existing waiting worker if present.
  }

  const waitingWorker = registration.waiting || await waitForWaitingServiceWorker(registration);
  if (!waitingWorker) {
    return false;
  }

  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}
