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
    'visitor:deleted',
    'appointment:created',
    'appointment:updated',
    'appointment:approved',
    'appointment:cancelled',
    'appointment:deleted',
    'personnel:created',
    'personnel:updated',
    'personnel:deleted',
    'blacklist:created',
    'blacklist:deleted',
    'room:created',
    'room:updated',
    'room:deleted',
    'room:reserved',
    'room:reservation_cancelled',
    'user:created',
    'user:updated',
    'user:deleted',
    'company:created',
    'company:updated',
    'company:deleted',
    'screen:update',
    'system:reload',
    'content:updated',
    'settings:updated',
  ];

  function vdCreateSocket(options) {
    const opts = options || {};
    if (typeof io === 'undefined') {
      console.warn('Socket.IO client is not available.');
      return null;
    }

    const socket = io(opts.url, opts.ioOptions || {});
    const handlers = opts.handlers || {};

    function runHandler(label, fn, args) {
      if (typeof fn !== 'function') return undefined;
      try {
        return fn.apply(null, args);
      } catch (err) {
        console.error(`[Socket] Handler failed for ${label}:`, err);
        return undefined;
      }
    }

    SOCKET_EVENTS.forEach(function(eventName) {
      socket.on(eventName, function(payload) {
        if (eventName === 'system:reload') {
          if (typeof opts.onSystemReload === 'function') {
            const shouldContinue = runHandler('system:reload:onSystemReload', opts.onSystemReload, [payload, socket]);
            if (shouldContinue === false) return;
          }
          if (opts.autoReloadOnSystem !== false) {
            window.location.reload();
            return;
          }
        }

        runHandler(eventName, handlers[eventName], [payload, socket]);
        runHandler('*', handlers['*'], [eventName, payload, socket]);
      });
    });

    if (typeof opts.onConnect === 'function') {
      socket.on('connect', function() { runHandler('connect', opts.onConnect, [socket]); });
    }
    if (typeof opts.onDisconnect === 'function') {
      socket.on('disconnect', function(reason) { runHandler('disconnect', opts.onDisconnect, [reason, socket]); });
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
