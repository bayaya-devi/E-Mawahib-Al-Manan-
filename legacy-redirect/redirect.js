(() => {
  const destination = document.documentElement.dataset.target || "/ar";
  const target = new URL(destination, "https://e-mawahib-al-manan.vercel.app");
  const cleanup = async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("mawahib-")).map((name) => caches.delete(name)));
    }
  };
  cleanup().finally(() => window.location.replace(target.href));
})();
