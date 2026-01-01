const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy HTTP API requests to backend (CRA's "proxy" field already does this for simple cases)
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8081',
      changeOrigin: true,
      ws: false, // HTTP only for API
    })
  );

  // Proxy SockJS/STOMP websocket endpoint to backend and enable websocket proxying
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:8081',
      changeOrigin: true,
      ws: true,
      logLevel: 'debug',
    })
  );

  // Serve uploaded files from backend
  app.use(
    '/uploads',
    createProxyMiddleware({
      target: 'http://localhost:8081',
      changeOrigin: true,
      ws: false,
    })
  );
};
