window.setPageMeta = function (opts) {
  var title = opts.title || '';
  var description = opts.description || '';
  var image = opts.image || '';

  if (title) document.title = title;

  var metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = 'description';
    document.head.appendChild(metaDesc);
  }
  if (description) metaDesc.content = description;

  var ogPairs = [];
  if (title) ogPairs.push(['og:title', title]);
  if (description) ogPairs.push(['og:description', description]);
  if (image) ogPairs.push(['og:image', image]);
  ogPairs.push(['og:url', window.location.href]);

  ogPairs.forEach(function (pair) {
    var el = document.querySelector('meta[property="' + pair[0] + '"]');
    if (el) el.content = pair[1];
  });
};

window.scrollToPagination = function () {
  var nav = document.querySelector('nav[aria-label="Pagination"]');
  if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.scrollToNav = function () {
  var nav = document.querySelector('nav[aria-label="Post navigation"]');
  if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.registerNavLocationListener = function (dotNetRef) {
  if (window.__navLocationListenerCleanup) {
    window.__navLocationListenerCleanup();
  }

  function notify() {
    dotNetRef.invokeMethodAsync('OnBrowserLocationChanged', window.location.hash || '');
  }

  function onAnchorClick(event) {
    var anchor = event.target.closest('a[href]');
    if (!anchor) return;
    var href = anchor.getAttribute('href');
    if (href && href.indexOf('#') !== -1) {
      queueMicrotask(notify);
    }
  }

  window.addEventListener('hashchange', notify);
  window.addEventListener('popstate', notify);
  document.addEventListener('click', onAnchorClick, true);

  // Blazor in-app navigation uses pushState/replaceState; hashchange does not fire.
  var nativePushState = history.pushState;
  var nativeReplaceState = history.replaceState;
  history.pushState = function () {
    nativePushState.apply(this, arguments);
    notify();
  };
  history.replaceState = function () {
    nativeReplaceState.apply(this, arguments);
    notify();
  };

  notify();

  window.__navLocationListenerCleanup = function () {
    window.removeEventListener('hashchange', notify);
    window.removeEventListener('popstate', notify);
    document.removeEventListener('click', onAnchorClick, true);
    history.pushState = nativePushState;
    history.replaceState = nativeReplaceState;
    window.__navLocationListenerCleanup = null;
  };
};

window.unregisterNavLocationListener = function () {
  if (window.__navLocationListenerCleanup) {
    window.__navLocationListenerCleanup();
  }
};
