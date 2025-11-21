# Nginx Deployment Plan for PDF OCR Application
**Created**: 2025-11-21 | **Status**: Planning

## Overview
Deploy Node.js Express PDF OCR app (port 3847) on Ubuntu server with Nginx reverse proxy, systemd process management, and SSL-ready configuration.

## Tech Stack
- **App**: Node.js/Express (port 3847), Multer file uploads (50MB max)
- **Dependencies**: Tesseract OCR (Vietnamese), Poppler utils
- **Proxy**: Nginx with SSL termination, static file serving
- **Process**: systemd service with graceful shutdown

## Phases

| Phase | Name | Status | File |
|-------|------|--------|------|
| 01 | Production Build Preparation | Pending | [phase-01-production-build.md](./phase-01-production-build.md) |
| 02 | System Dependencies Setup | Pending | [phase-02-system-dependencies.md](./phase-02-system-dependencies.md) |
| 03 | Systemd Service Configuration | Pending | [phase-03-systemd-service.md](./phase-03-systemd-service.md) |
| 04 | Nginx Configuration | Pending | [phase-04-nginx-config.md](./phase-04-nginx-config.md) |
| 05 | Deployment Script | Pending | [phase-05-deployment-script.md](./phase-05-deployment-script.md) |

## Deployment Order
```
Phase 2 (deps) -> Phase 1 (build) -> Phase 3 (systemd) -> Phase 4 (nginx) -> Phase 5 (script)
```

## Quick Reference
- **App Port**: 3847
- **Deploy Path**: `/opt/pdf-ocr`
- **Service User**: `pdf-ocr`
- **Nginx Config**: `/etc/nginx/sites-available/pdf-ocr`
- **Service File**: `/etc/systemd/system/pdf-ocr.service`
- **Environment**: `/etc/pdf-ocr/.env.production`

## Success Criteria
- [ ] App accessible via domain with HTTPS
- [ ] Auto-restart on crash via systemd
- [ ] Static files served by Nginx
- [ ] Health endpoint responding
- [ ] Large file uploads working (50MB)
- [ ] Graceful shutdown preserves in-progress OCR

## Research References
- [Nginx + Node.js Research](./research/researcher-01-nginx-nodejs.md)
- [Node.js Packaging Research](./research/researcher-02-nodejs-packaging.md)
