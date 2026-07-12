(function () {
  const bellBtn = document.getElementById('bell-btn');
  const prefsSheet = document.getElementById('prefs-sheet');
  const prefsBackdrop = document.getElementById('prefs-backdrop');
  const prefsClose = document.getElementById('prefs-close');
  const enableBtn = document.getElementById('prefs-enable-btn');

  const selectedRegions = new Set();
  const selectedCategories = new Set();

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  function openPrefs() {
    prefsBackdrop.classList.add('open');
    prefsSheet.classList.add('open');
  }

  function closePrefs() {
    prefsBackdrop.classList.remove('open');
    prefsSheet.classList.remove('open');
  }

  bellBtn.addEventListener('click', openPrefs);
  prefsClose.addEventListener('click', closePrefs);
  prefsBackdrop.addEventListener('click', closePrefs);

  document.querySelectorAll('#prefs-regions button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const active = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!active));
      active ? selectedRegions.delete(btn.dataset.value) : selectedRegions.add(btn.dataset.value);
    });
  });

  document.querySelectorAll('#prefs-categories button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const active = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!active));
      active ? selectedCategories.delete(btn.dataset.value) : selectedCategories.add(btn.dataset.value);
    });
  });

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      window.CymorToast?.('Push notifications aren\'t supported in this browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        window.CymorToast?.('Notifications stay off until you allow them in browser settings.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const keyRes = await fetch('/api/vapid-public-key');
      if (!keyRes.ok) {
        window.CymorToast?.('Notifications aren\'t set up on the server yet.');
        return;
      }
      const { publicKey } = await keyRes.json();

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          regions: [...selectedRegions],
          categories: [...selectedCategories],
          breakingOnly: true
        })
      });

      bellBtn.setAttribute('data-active', 'true');
      window.CymorToast?.('Notifications turned on — you\'ll get breaking alerts.');
      closePrefs();
    } catch (err) {
      console.error('[notifications] subscribe failed:', err);
      window.CymorToast?.('Something went wrong turning on notifications.');
    }
  }

  enableBtn.addEventListener('click', subscribeToPush);

  // Reflect existing subscription state on load, if any.
  async function checkExistingSubscription() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) bellBtn.setAttribute('data-active', 'true');
    } catch (err) {
      // no-op: not critical if this check fails
    }
  }

  checkExistingSubscription();
})();
