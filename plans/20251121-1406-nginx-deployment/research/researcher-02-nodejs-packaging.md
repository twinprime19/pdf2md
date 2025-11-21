# Node.js Production Deployment & Packaging Research

## 1. Production Build Preparation

**npm ci vs npm install:**
- `npm ci` (clean install): Installs exact versions from package-lock.json, deterministic, preferred for production. Fails if lock file missing.
- `npm install`: May upgrade packages, non-deterministic, use only for development. Never use in CI/CD pipelines.

**Best Practice Flow:**
```bash
# Development
npm install

# Before commit
npm ci --audit-fix (if needed)

# Production deployment
npm ci --production  # Skip devDependencies
```

**Why it matters:** Ensures reproducible builds, prevents dependency drift, reduces supply chain attacks.

## 2. Environment Variable Management

**Production Configuration:**
- Use `.env.production` with git-ignored `.env.local` for sensitive values
- Never commit secrets; use environment secrets in deployment system
- Tools: `dotenv` for local dev, systemd `EnvironmentFile=` for production
- Validate required vars on app startup to fail fast

**Systemd Integration:**
```
EnvironmentFile=/etc/myapp/.env.production
Environment="NODE_ENV=production"
```

## 3. Systemd Service Files for Node.js

**Standard Service File Template:**
```ini
[Unit]
Description=My Node.js Application
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/myapp
EnvironmentFile=/etc/myapp/.env.production
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /opt/myapp/dist/index.js
Restart=on-failure
RestartSec=10s
TimeoutStopSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier=myapp

[Install]
WantedBy=multi-user.target
```

**Key Directives:**
- `Type=simple`: App runs as single process (ideal for Node.js)
- `Restart=on-failure`: Auto-restarts on non-zero exit; set `RestartSec=10s` delay
- `TimeoutStopSec=30`: Grace period before SIGKILL (match app shutdown timeout)
- `StandardOutput=journal`: Logs to systemd journal (journalctl)

**Multi-Instance Scaling:**
```ini
# /etc/systemd/system/myapp@.service (template)
ExecStart=/usr/bin/node /opt/myapp/dist/index.js --port=%I

# Enable: systemctl enable myapp@3000 myapp@3001
```

## 4. Log Management & Rotation

**Systemd Journal (preferred):**
- Automatically logs stdout/stderr via `StandardOutput=journal`
- View: `journalctl -u myapp -f` (tail) or `-n 100` (last 100 lines)
- Persists to `/var/log/journal/` (disk-backed)
- Auto-rotation: respects `/etc/systemd/journald.conf` (default ~10% disk)

**Application-Level Logging:**
- Use structured JSON logging (bunyan, winston, pino)
- Write to stdout/stderr, let systemd handle rotation
- Example (Winston):
```javascript
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});
```

**External Log Rotation (logrotate):**
```
/opt/myapp/logs/*.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
  postrotate
    systemctl reload myapp >/dev/null 2>&1 || true
  endscript
}
```

## 5. Health Checks & Monitoring

**Application-Level Checks:**
- Expose `/health` endpoint returning 200 + JSON: `{"status":"ok","uptime":123}`
- Check critical services (DB, cache connections)
- Integrate with external monitors (DataDog, New Relic, Prometheus)

**Systemd Health Integration:**
```ini
ExecStart=/usr/bin/node --require ./health-check-wrapper.js /opt/myapp/dist/index.js
ExecStartPost=/usr/local/bin/wait-for-health.sh http://localhost:3000/health
```

**Process Monitoring:**
```bash
# Check service status
systemctl status myapp

# View recent logs
journalctl -u myapp -n 50

# Monitor in real-time
journalctl -u myapp -f
```

## 6. Graceful Shutdown Handling

**Critical for Tesseract/Poppler Apps (long-running tasks):**

**Node.js Implementation:**
```javascript
const server = http.createServer(app);
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, graceful shutdown...');
  isShuttingDown = true;

  server.close(async () => {
    // Wait for pending OCR/PDF jobs
    await waitForPendingTasks(5000); // 5s timeout
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => process.exit(1), 30000);
});

// Block new requests during shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.status(503).send('Service shutting down');
    return;
  }
  next();
});
```

**Systemd Configuration:**
```ini
TimeoutStopSec=30  # Allows 30s for graceful shutdown
KillSignal=SIGTERM  # Send SIGTERM first, SIGKILL after timeout
```

## 7. System Dependencies (Tesseract, Poppler)

**Package Management Approaches:**

**1. Include in Docker (Recommended for portability):**
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache tesseract-ocr poppler-utils ghostscript
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**2. System Package Installation (Bare Metal):**
```bash
# Ubuntu/Debian
sudo apt-get update && apt-get install -y \
  tesseract-ocr tesseract-ocr-vie \
  poppler-utils ghostscript \
  libpoppler-cpp-dev

# RedHat/CentOS
sudo yum install -y tesseract poppler-utils ghostscript
```

**3. Verify Installation:**
```bash
tesseract --version
pdfinfo --version
gs --version
```

**Critical: App Should Verify Dependencies on Startup:**
```javascript
const { execSync } = require('child_process');

function verifyDependencies() {
  const deps = ['tesseract', 'pdfinfo', 'gs'];
  deps.forEach(cmd => {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
    } catch {
      throw new Error(`Missing system dependency: ${cmd}`);
    }
  });
}

verifyDependencies(); // Call at app startup
```

---

## Summary Table: Deployment Checklist

| Component | Method | Key Point |
|-----------|--------|-----------|
| Build | `npm ci --production` | Deterministic, no devDeps |
| Service Management | systemd | Auto-restart on failure |
| Environment | EnvironmentFile | Secure, centralized |
| Logging | journalctl | Auto-rotation, unified |
| Shutdown | SIGTERM handler | Grace period for tasks |
| Dependencies | Docker/APK/YUM | Verified at startup |
| Health | HTTP endpoint | External monitor integration |

## Unresolved Questions
- Which monitoring service (DataDog/Prometheus/native) preferred for this project?
- Log retention policy duration for audit compliance?
- Should health checks include Tesseract/Poppler process validation?
