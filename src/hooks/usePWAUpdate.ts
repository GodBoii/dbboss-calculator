import { useEffect, useState, useCallback } from 'react';

interface PWAUpdateState {
  updateAvailable: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

/**
 * Custom hook to manage PWA updates
 * Detects when a new service worker is available and provides methods to update
 */
export function usePWAUpdate(): PWAUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Only run in browser and if service workers are supported
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Check for waiting service worker on mount
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }
    });

    // Listen for new service worker updates
    const handleUpdateFound = (registration: ServiceWorkerRegistration) => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is installed and waiting
          setWaitingWorker(newWorker);
          setUpdateAvailable(true);
        }
      });
    };

    // Listen for controller change (when new SW takes over)
    const handleControllerChange = () => {
      // Reload the page to load new content
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check existing registration
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        registration.addEventListener('updatefound', () => handleUpdateFound(registration));
        
        // Check if there's already a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }
      }
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  /**
   * Manually check for updates by updating the service worker registration
   */
  const checkForUpdate = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    setIsChecking(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // Force check for updates
        await registration.update();
        
        // Wait a bit to see if an update was found
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Install the waiting service worker and reload the page
   */
  const installUpdate = useCallback(async () => {
    if (!waitingWorker) {
      return;
    }

    setIsUpdating(true);

    // Send SKIP_WAITING message to the waiting service worker
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // The controllerchange event will trigger a reload
  }, [waitingWorker]);

  return {
    updateAvailable,
    isChecking,
    isUpdating,
    checkForUpdate,
    installUpdate,
  };
}
