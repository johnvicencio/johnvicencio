(function () {
  var endpoint = '/.netlify/functions/logs';
  var lastSignature = '';
  var lastSentAt = 0;

  function text(value, fallback) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && value.message) return String(value.message);
    return fallback || 'Browser error';
  }

  function send(payload) {
    try {
      var signature = [payload.message, payload.file, payload.line, payload.column].join('|');
      var now = Date.now();
      if (signature === lastSignature && now - lastSentAt < 5000) return;
      lastSignature = signature;
      lastSentAt = now;

      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(endpoint, blob)) return;
      }

      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () { });
    } catch (_) {
    }
  }

  window.jvLogError = function (error, details) {
    details = details || {};
    send({
      source: details.source || 'Browser',
      message: text(details.message || error, 'Browser error'),
      url: window.location.href,
      file: details.file || '',
      line: details.line || 0,
      column: details.column || 0,
      stack: error && error.stack ? String(error.stack) : ''
    });
  };

  window.addEventListener('error', function (event) {
    window.jvLogError(event.error, {
      source: 'BrowserError',
      message: event.message,
      file: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason || {};
    window.jvLogError(reason, {
      source: 'UnhandledPromise',
      message: text(reason, 'Unhandled promise rejection')
    });
  });
})();
