// -- Simdesk Socket Core ------------------------------------------------------
(function() {
  if (window.vdCreateSocket) return;

  const SOCKET_EVENTS = [
    'visitor:waiting',
    'visitor:approved',
    'visitor:arrived',
    'visitor:rejected',
    'visitor:checkout',
    'visitor:cancelled',
    'screen:update',
    'system:reload',
  ];

  function vdCreateSocket(options) {
    const opts = options || {};
    if (typeof io === 'undefined') {
      console.warn('Socket.IO client is not available.');
      return null;
    }

    const socket = io(opts.url, opts.ioOptions || {});
    const handlers = opts.handlers || {};

    SOCKET_EVENTS.forEach(function(eventName) {
      socket.on(eventName, function(payload) {
        if (eventName === 'system:reload') {
          if (typeof opts.onSystemReload === 'function') {
            const shouldContinue = opts.onSystemReload(payload, socket);
            if (shouldContinue === false) return;
          }
          if (opts.autoReloadOnSystem !== false) {
            window.location.reload();
            return;
          }
        }

        if (typeof handlers[eventName] === 'function') {
          handlers[eventName](payload, socket);
        }
        if (typeof handlers['*'] === 'function') {
          handlers['*'](eventName, payload, socket);
        }
      });
    });

    if (typeof opts.onConnect === 'function') {
      socket.on('connect', function() { opts.onConnect(socket); });
    }
    if (typeof opts.onDisconnect === 'function') {
      socket.on('disconnect', function(reason) { opts.onDisconnect(reason, socket); });
    }

    return socket;
  }

  function vdDestroySocket(socket) {
    if (!socket) return;
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch (_) {
      // no-op
    }
  }

  window.vdSocketEvents = SOCKET_EVENTS.slice();
  window.vdCreateSocket = vdCreateSocket;
  window.vdDestroySocket = vdDestroySocket;
})();
