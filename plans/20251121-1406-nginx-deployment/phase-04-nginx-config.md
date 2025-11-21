# Phase 04: Nginx Configuration

## Context
- **Parent**: [plan.md](./plan.md)
- **Dependencies**: Phase 03 (systemd service running)
- **Related**: [researcher-01-nginx-nodejs.md](./research/researcher-01-nginx-nodejs.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-11-21 |
| Priority | High |
| Status | Pending |
| Description | Configure Nginx as reverse proxy with static file serving and SSL support |

## Key Insights
- Nginx serves static files faster than Node.js
- Disable proxy buffering for file uploads
- Extended timeouts needed for large PDF processing (up to 5 min)
- SSL termination at Nginx reduces Node.js CPU load

## Requirements
1. Reverse proxy to Node.js (port 3847)
2. Static file serving from /public
3. Large file upload support (50MB)
4. Extended timeouts for OCR processing
5. SSL-ready configuration
6. Security headers

## Implementation Steps

### Step 1: Install Nginx
```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### Step 2: Create Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/pdf-ocr
```

Content:
```nginx
# Upstream for Node.js app
upstream pdf_ocr_backend {
    server 127.0.0.1:3847;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    # Redirect HTTP to HTTPS (uncomment when SSL configured)
    # return 301 https://$server_name$request_uri;

    # Root for static files
    root /opt/pdf-ocr/public;

    # Logging
    access_log /var/log/nginx/pdf-ocr-access.log;
    error_log /var/log/nginx/pdf-ocr-error.log;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1024;

    # Client body size for file uploads (50MB)
    client_max_body_size 55M;

    # Static files - served directly by Nginx
    location ~* \.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Health check - bypass buffering
    location = /health {
        proxy_pass http://pdf_ocr_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # API endpoints - proxy to Node.js
    location /api/ {
        proxy_pass http://pdf_ocr_backend;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # Disable buffering for uploads
        proxy_buffering off;
        proxy_request_buffering off;

        # Extended timeouts for OCR processing (5 minutes)
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Root location - serve index.html or proxy
    location / {
        try_files $uri $uri/ @backend;
    }

    location @backend {
        proxy_pass http://pdf_ocr_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTPS server (uncomment after SSL certificate setup)
# server {
#     listen 443 ssl http2;
#     server_name your-domain.com;
#
#     ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
#
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#     ssl_session_cache shared:SSL:10m;
#
#     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
#
#     # ... (copy all location blocks from HTTP server above)
# }
```

### Step 3: Enable site and test
```bash
# Enable site
sudo ln -sf /etc/nginx/sites-available/pdf-ocr /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 4: Set up SSL with Let's Encrypt (optional)
```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
sudo systemctl status certbot.timer
```

### Step 5: Verify deployment
```bash
# Health check
curl http://localhost/health

# Static file
curl -I http://localhost/styles.css

# API endpoint (with file upload)
curl -X POST -F "pdf=@test.pdf" http://localhost/api/ocr
```

## Nginx Management Commands
```bash
# Test configuration
sudo nginx -t

# Reload (graceful)
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# View logs
tail -f /var/log/nginx/pdf-ocr-access.log
tail -f /var/log/nginx/pdf-ocr-error.log
```

## Todo
- [ ] Install Nginx
- [ ] Create site configuration
- [ ] Enable site
- [ ] Test configuration
- [ ] (Optional) Set up SSL certificate
- [ ] Verify all endpoints

## Success Criteria
- [ ] `curl http://localhost/health` returns `{"status":"OK"}`
- [ ] Static files served with cache headers
- [ ] File upload works via `/api/ocr`
- [ ] No Nginx errors in logs
- [ ] (If SSL) HTTPS redirect works

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Upload timeout | High | 300s proxy_read_timeout |
| Static file 404 | Medium | try_files with fallback |
| Buffer overflow | Low | Disabled proxy buffering |

## Security Considerations
- X-Frame-Options prevents clickjacking
- X-Content-Type-Options prevents MIME sniffing
- client_max_body_size limits upload size at Nginx level
- SSL with TLS 1.2+ only (when enabled)
- HSTS header forces HTTPS

## Next Steps
Proceed to Phase 05 (Deployment Script)
