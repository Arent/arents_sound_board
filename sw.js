const CACHE = "soundboard-v4";
const SHELL = ["./index.html", "./icon.svg", "./sw.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL);
      const index = await cache.match("./index.html");
      if (!index) return;
      const scope = self.registration.scope;
      await cache.put(scope, index.clone());
      await cache.put(scope + "index.html", index.clone());
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function shouldCache(res) {
  return res.ok || res.type === "opaque";
}

async function matchCached(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  if (request.mode !== "navigate") return null;
  const cache = await caches.open(CACHE);
  for (const req of await cache.keys()) {
    const url = req.url;
    if (url.endsWith("/index.html") || url.endsWith(self.registration.scope)) {
      const page = await cache.match(req);
      if (page) return page;
    }
  }
  return null;
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    matchCached(e.request).then((cached) => {
      if (cached) {
        if (e.request.mode === "navigate") {
          e.waitUntil(
            fetch(e.request)
              .then((res) => {
                if (res.ok) {
                  const copy = res.clone();
                  return caches.open(CACHE).then((c) => {
                    c.put(e.request, copy);
                    c.put("./index.html", copy.clone());
                  });
                }
              })
              .catch(() => {})
          );
        }
        return cached;
      }
      return fetch(e.request).then((res) => {
        if (shouldCache(res)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
