const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('Setting up proxy middleware...');
  
  // Proxy HTTP API requests to backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8081',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api',
      },
      logLevel: 'warn',
    })
  );

  // Proxy SockJS/STOMP websocket endpoint to backend with explicit WebSocket support
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:8081',
      changeOrigin: true,
      ws: true,
      pathRewrite: {
        '^/ws': '/ws',
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy response:', req.method, req.path, proxyRes.statusCode);
      },
      onError: (err, req, res) => {
        console.error('Proxy error on', req.path, ':', err);
      },
      logLevel: 'warn',
    })
  );
  
  console.log('Proxy middleware configured successfully');
};
