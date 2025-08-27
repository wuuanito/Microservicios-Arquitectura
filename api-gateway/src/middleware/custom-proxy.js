const http = require('http');
const { URL } = require('url');

function createCustomProxy(routeConfig) {
  return (req, res, next) => {
    // Apply path rewriting
    let targetPath = req.originalUrl;
    if (routeConfig.pathRewrite) {
      Object.keys(routeConfig.pathRewrite).forEach(pattern => {
        const regex = new RegExp(pattern);
        if (regex.test(req.originalUrl)) {
          targetPath = req.originalUrl.replace(regex, routeConfig.pathRewrite[pattern]);
        }
      });
    }

    const targetUrl = new URL(targetPath, routeConfig.target);
    
    console.log(`*** CUSTOM PROXY ***`);
    console.log(`Original: ${req.method} ${req.originalUrl}`);  
    console.log(`Route target: ${routeConfig.target}`);
    console.log(`Target path: ${targetPath}`);
    console.log(`Final URL: ${targetUrl.href}`);
    console.log(`Hostname: ${targetUrl.hostname}, Port: ${targetUrl.port}`);

    const options = {
      hostname: targetUrl.hostname,
      port: parseInt(targetUrl.port) || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'host': targetUrl.host,
        'x-forwarded-for': req.ip || req.connection.remoteAddress,
        'x-forwarded-proto': req.protocol
      }
    };

    // Remove hop-by-hop headers
    delete options.headers['connection'];
    delete options.headers['upgrade'];
    delete options.headers['http2-settings'];
    delete options.headers['te'];
    delete options.headers['transfer-encoding'];
    delete options.headers['proxy-authorization'];
    delete options.headers['proxy-authenticate'];

    const proxyReq = http.request(options, (proxyRes) => {
      console.log(`Custom Proxy Response: ${proxyRes.statusCode}`);
      
      // Set response status
      res.status(proxyRes.statusCode);
      
      // Copy response headers
      Object.keys(proxyRes.headers).forEach(key => {
        res.set(key, proxyRes.headers[key]);
      });
      
      // Pipe the response
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`Custom Proxy Error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: err.message
        });
      }
    });

    proxyReq.setTimeout(10000, () => {
      console.error('Custom Proxy Timeout');
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Gateway Timeout'
        });
      }
      proxyReq.destroy();
    });

    // Handle request body for POST/PUT/PATCH
    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const bodyData = JSON.stringify(req.body);
      console.log(`Custom Proxy Body: ${bodyData}`);
      
      proxyReq.setHeader('content-type', 'application/json');
      proxyReq.setHeader('content-length', Buffer.byteLength(bodyData));
      
      proxyReq.write(bodyData);
    }

    proxyReq.end();
  };
}

module.exports = createCustomProxy;