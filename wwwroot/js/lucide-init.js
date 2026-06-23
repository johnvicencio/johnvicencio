(function () {
  let refreshTimer = null;

  function scheduleRefresh() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(function () {
      if (typeof window.refreshLucideIcons === "function") {
        window.refreshLucideIcons();
      }
    }, 16);
  }

  function nodeHasIcons(node) {
    if (!node || node.nodeType !== 1) {
      return false;
    }

    if (node.matches?.("i[data-lucide]")) {
      return true;
    }

    return !!node.querySelector?.("i[data-lucide]");
  }

  function startObserver() {
    if (!window.MutationObserver || !document.body) {
      return;
    }

    const observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        if (mutation.type !== "childList" || mutation.addedNodes.length === 0) {
          continue;
        }

        for (const node of mutation.addedNodes) {
          if (nodeHasIcons(node)) {
            scheduleRefresh();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (typeof window.ensureCustomLucideIcons === "function") {
      window.ensureCustomLucideIcons();
    }

    scheduleRefresh();
    startObserver();
    window.addEventListener("load", scheduleRefresh);
    window.setTimeout(scheduleRefresh, 250);
    window.setTimeout(scheduleRefresh, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
