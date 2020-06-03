var cacheName = <% print (Date.now()) %>;
var filesToCache = [<% print((cache || []).join(',')) %>];

function onCacheOpenForInstall (cache) {
  return cache.addAll(filesToCache);
}

function install (event) {
  event.waitUntil(caches.open(cacheName).then(onCacheOpenForInstall));
}

function deleteCache(cachename) {
  console.log('serviceWorker deleteCache', cachename);
  return caches.delete(cachename);
}
function notmycache (cachename) {
  return cachename!=cacheName;
}
function clearAllCachesButMine (cachenames) {
  console.log('serviceWorker cachenames', cachenames);
  console.log('serviceWorker cachenames after filter', cachenames.filter(notmycache));
  return Promise.all(cachenames.filter(notmycache).map(deleteCache));
}

function clearOldCaches (event) {
  event.waitUntil(caches.keys().then(clearAllCachesButMine));
}

self.addEventListener('install', install);
self.addEventListener('activate', clearOldCaches);
