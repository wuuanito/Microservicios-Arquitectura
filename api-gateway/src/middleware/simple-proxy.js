const http = require('http');
const { URL } = require('url');

function createSimpleProxy(routeConfig) {
  return (req, res, next) => {
    const targetUrl = new URL(req.originalUrl.replace('/api/auth/v1', '/api/auth'), routeConfig.target);
    
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        'host': targetUrl.host,
        'x-forwarded-for': req.ip,
        'x-forwarded-proto': req.protocol,
        'x-api-gateway': 'true'
      }
    };

    console.log(`Simple Proxy: ${req.method} ${req.originalUrl} -> ${routeConfig.target}${targetUrl.pathname}`);

    const proxyReq = http.request(options, (proxyRes) => {
      // Copy status code
      res.status(proxyRes.statusCode);
      
      // Copy headers
      Object.keys(proxyRes.headers).forEach(key => {
        res.set(key, proxyRes.headers[key]);
      });
      
      // Pipe response
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`Proxy error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Proxy error',
          message: err.message
        });
      }
    });

    proxyReq.setTimeout(10000, () => {
      console.error('Proxy timeout');
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Gateway timeout'
        });
      }
      proxyReq.destroy();
    });

    // Forward request body
    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      proxyReq.write(JSON.stringify(req.body));
    }
    
    proxyReq.end();
  };
}

module.exports = createSimpleProxy;