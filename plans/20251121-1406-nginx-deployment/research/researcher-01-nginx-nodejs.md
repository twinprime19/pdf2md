# Nginx Deployment for Node.js Express Applications
**Research Report | 2025-11-21**

## 1. Nginx as Reverse Proxy for Node.js

Nginx functions as a reverse proxy by receiving client requests, forwarding them to backend Node.js applications, retrieving responses, and sending them back. This architecture provides critical benefits:

- **Load distribution**: Handle high traffic volumes efficiently
- **Application isolation**: Backend app not directly exposed to internet
- **Performance improvement**: Nginx handles connection pooling and HTTP optimization
- **Simplified scaling**: Multiple Node.js instances managed behind single proxy

**Basic proxy pattern:**
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3847;
    }
}
```

## 2. Nginx Configuration for Express Apps

### Proxy Pass & Headers
```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:3847;

        # Forward original request info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for long-running requests (e.g., file uploads)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering control for large responses
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

**Critical headers for Express:**
- `X-Real-IP`: Preserves original client IP (use with `app.set('trust proxy', 1)`)
- `X-Forwarded-For`: Chain of IPs through proxies
- `X-Forwarded-Proto`: Original request protocol (http/https)
- `Upgrade/Connection`: WebSocket protocol support

## 3. SSL/TLS Termination with Nginx

SSL termination at Nginx offloads encryption/decryption overhead from Node.js, improving performance. Configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HTTP/2 support for better multiplexing

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}
```

**Best practice**: Keep internal communication (nginx ↔ Node.js) on HTTP if on same server. No need for TLS between proxy and backend.

### Certificate Management
Use Let's Encrypt with Certbot for free automated certificates:
```bash
sudo certbot certonly --webroot -w /var/www/html -d api.example.com
```

## 4. Static File Serving

Nginx outperforms Node.js for static files. Configuration:

```nginx
server {
    listen 80;
    server_name api.example.com;

    # Serve static assets directly
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/app/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API endpoints to Node.js
    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Rationale**: Nginx serves static files with zero Node.js overhead. Use gzip compression in nginx for text assets.

## 5. Common Production Configurations

### Full Production Setup
```nginx
upstream node_app {
    # Connection pooling
    keepalive 64;
    server 127.0.0.1:3847 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3848 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3849 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    # SSL config (see section 3)
    ssl_certificate ...;
    ssl_certificate_key ...;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1024;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://node_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}
```

## 6. Process Management

### PM2 Approach (Recommended for Application Management)
```bash
npm install -g pm2
pm2 start server.js -i max --name "pdf-ocr"
pm2 startup
pm2 save
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'pdf-ocr',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3847
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      max_memory_restart: '1G'
    }
  ]
};
```

### Systemd Service (Alternative)
```ini
# /etc/systemd/system/pdf-ocr.service
[Unit]
Description=PDF OCR Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/app
ExecStart=/usr/bin/node /var/www/app/server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="PORT=3847"

[Install]
WantedBy=multi-user.target
```

Enable & manage:
```bash
sudo systemctl enable pdf-ocr
sudo systemctl start pdf-ocr
sudo systemctl status pdf-ocr
```

## Production Deployment Checklist

1. **Reverse Proxy Setup**
   - Configure nginx upstream with multiple Node.js instances
   - Enable keepalive connections
   - Set appropriate timeouts for your use case

2. **SSL/TLS**
   - Use HTTPS with TLS 1.2+
   - Enable HTTP/2 for better performance
   - Set strict HSTS headers
   - Auto-renew certificates with Certbot

3. **Process Management**
   - Use PM2 or systemd for automatic restarts
   - Monitor memory usage (set limits)
   - Enable clustering for multi-core usage

4. **Static Files**
   - Serve via nginx directly
   - Enable gzip compression
   - Set appropriate cache headers

5. **Headers & Security**
   - Forward X-Real-IP, X-Forwarded-For
   - Set security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
   - Configure CORS if needed

6. **Monitoring**
   - Log access/errors separately
   - Monitor Node.js process memory
   - Use PM2 monitoring dashboard

## Summary

Nginx + Node.js is a proven production pattern:
- Nginx handles SSL/TLS termination, static files, compression, load balancing
- Node.js focuses solely on dynamic application logic
- PM2 or systemd ensures application reliability
- Proper headers maintain client IP transparency and security context
