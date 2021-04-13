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


function fetcher (event) {
  event.respondWith((new Fetcher(event.request)).go().then(a => a));
}

function Fetcher (request) {
  this.resolve = null;
  this.reject = null;
  this.request = request;
}
Fetcher.prototype.destroy = function () {
  this.request = null;
  this.reject = null;
  this.resolve = null;
};
Fetcher.prototype.fail = function (reason) {
  console.error(reason, 'for', this.request.url);
  this.resolve(new Response(new Blob(), {status: 200, statusText: 'Fallback contents'}));
  this.destroy();
};
Fetcher.prototype.succeed = function (response) {
  this.resolve(response);
  this.destroy();
};
Fetcher.prototype.onGo = function (resolve, reject) {
  this.resolve = resolve;
  this.reject = reject;
  caches.open(cacheName).then(
    this.onCache.bind(this),
    this.fail.bind(this)
  )
};
Fetcher.prototype.go = function () {
  return new Promise(this.onGo.bind(this));
};
Fetcher.prototype.onCache = function (cache) {
  cache.match(this.request).then(
    this.onMatch.bind(this),
    this.goOnline.bind(this)
  );
};
Fetcher.prototype.onMatch = function (response) {
  if (response) {
    this.succeed(response);
    return;
  }
  this.goOnline();
};
Fetcher.prototype.goOnline = function (reason) {
  if (reason) {
    console.error(reason);
  }
  fetch(this.request).then(
    this.onOnlineFetch.bind(this),
    this.fail.bind(this)
  );
};
Fetcher.prototype.onOnlineFetch = function (response) {
  if (response) {
    this.succeed(response);
    return;
  }
  console.error('Need fallback for', this.request.url);
  this.fail();
};

self.addEventListener('fetch', fetcher);
