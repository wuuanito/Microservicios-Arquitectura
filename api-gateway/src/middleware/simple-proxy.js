const http = require('http');
const { URL } = require('url');

function createSimpleProxy(routeConfig) {
  return (req, res, next) => {
    console.log('=== Proxy middleware started ===');
    console.log('Method:', req.method, 'URL:', req.originalUrl);
    console.log('Body:', req.body);
    let rewrittenPath = req.originalUrl;
    
    // Apply path rewriting if configured
    if (routeConfig.pathRewrite) {
      Object.keys(routeConfig.pathRewrite).forEach(pattern => {
        const regex = new RegExp(pattern);
        if (regex.test(req.originalUrl)) {
          rewrittenPath = req.originalUrl.replace(regex, routeConfig.pathRewrite[pattern]);
        }
      });
    }
    
    const targetUrl = new URL(rewrittenPath, routeConfig.target);
    
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

    // Ensure Content-Type is preserved for POST requests
    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const bodyString = JSON.stringify(req.body);
      options.headers['content-type'] = 'application/json';
      options.headers['content-length'] = Buffer.byteLength(bodyString);
    }

    console.log(`Simple Proxy: ${req.method} ${req.originalUrl} -> ${targetUrl.href}`);
    console.log(`Proxy headers:`, options.headers);
    console.log(`Request body:`, req.body);

    const proxyReq = http.request(options, (proxyRes) => {
      console.log(`Proxy response status: ${proxyRes.statusCode}`);
      console.log(`Proxy response headers:`, proxyRes.headers);
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

    proxyReq.setTimeout(5000, () => {
      console.error('Proxy timeout - request did not complete within 5 seconds');
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Gateway timeout'
        });
      }
      proxyReq.destroy();
    });

    // Forward request body
    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const bodyString = JSON.stringify(req.body);
      console.log('Writing body to proxy request:', bodyString);
      proxyReq.write(bodyString);
    }
    
    console.log('Ending proxy request');
    proxyReq.end();
  };
}

module.exports = createSimpleProxy;