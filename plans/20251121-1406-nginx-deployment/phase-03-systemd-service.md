# Phase 03: Systemd Service Configuration

## Context
- **Parent**: [plan.md](./plan.md)
- **Dependencies**: Phase 01, Phase 02
- **Related**: [researcher-02-nodejs-packaging.md](./research/researcher-02-nodejs-packaging.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-11-21 |
| Priority | High |
| Status | Pending |
| Description | Create systemd service for auto-start, restart, and process management |

## Key Insights
- Use `Type=simple` for Node.js single-process apps
- 30s timeout for graceful shutdown (OCR jobs may be long)
- Journal logging eliminates need for manual log rotation
- EnvironmentFile for secure credential management

## Requirements
1. Service auto-starts on boot
2. Auto-restart on crash (with delay)
3. Graceful shutdown support
4. Secure environment variable handling
5. Logging to systemd journal

## Implementation Steps

### Step 1: Create environment file
```bash
sudo nano /etc/pdf-ocr/.env.production
```

Content:
```bash
NODE_ENV=production
PORT=3847
ENABLE_STREAMING=true
STREAMING_THRESHOLD_MB=10
MAX_MEMORY_MB=1024
CHECKPOINT_INTERVAL=10
LOG_LEVEL=info
```

Set permissions:
```bash
sudo chown root:pdf-ocr /etc/pdf-ocr/.env.production
sudo chmod 640 /etc/pdf-ocr/.env.production
```

### Step 2: Create systemd service file
```bash
sudo nano /etc/systemd/system/pdf-ocr.service
```

Content:
```ini
[Unit]
Description=PDF OCR Application (Vietnamese Text Extraction)
Documentation=https://github.com/your-repo/pdf-ocr
After=network.target

[Service]
Type=simple
User=pdf-ocr
Group=pdf-ocr
WorkingDirectory=/opt/pdf-ocr

# Environment
EnvironmentFile=/etc/pdf-ocr/.env.production

# Start command
ExecStart=/usr/bin/node /opt/pdf-ocr/server.js

# Restart policy
Restart=on-failure
RestartSec=10s

# Shutdown
TimeoutStopSec=30
KillSignal=SIGTERM

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pdf-ocr

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/pdf-ocr/temp /opt/pdf-ocr/checkpoints
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Step 3: Create runtime directories
```bash
sudo mkdir -p /opt/pdf-ocr/temp /opt/pdf-ocr/checkpoints
sudo chown pdf-ocr:pdf-ocr /opt/pdf-ocr/temp /opt/pdf-ocr/checkpoints
```

### Step 4: Enable and start service
```bash
sudo systemctl daemon-reload
sudo systemctl enable pdf-ocr
sudo systemctl start pdf-ocr
sudo systemctl status pdf-ocr
```

### Step 5: Verify logging
```bash
# View logs
journalctl -u pdf-ocr -f

# Last 50 lines
journalctl -u pdf-ocr -n 50

# Since last boot
journalctl -u pdf-ocr -b
```

## Service Management Commands
```bash
# Start/Stop/Restart
sudo systemctl start pdf-ocr
sudo systemctl stop pdf-ocr
sudo systemctl restart pdf-ocr

# Status
sudo systemctl status pdf-ocr

# Logs
journalctl -u pdf-ocr -f

# Reload after config change
sudo systemctl daemon-reload
sudo systemctl restart pdf-ocr
```

## Todo
- [ ] Create /etc/pdf-ocr/.env.production
- [ ] Create systemd service file
- [ ] Create runtime directories
- [ ] Enable service
- [ ] Verify logs in journal

## Success Criteria
- [ ] `systemctl status pdf-ocr` shows active
- [ ] Service survives server reboot
- [ ] Service auto-restarts after crash
- [ ] Logs visible in journalctl
- [ ] Health endpoint responds: `curl http://localhost:3847/health`

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Permission denied | High | ProtectSystem=strict + ReadWritePaths |
| OOM kill | Medium | MAX_MEMORY_MB limit |
| Zombie processes | Low | SIGTERM + 30s timeout |

## Security Considerations
- `NoNewPrivileges=true` prevents privilege escalation
- `ProtectSystem=strict` makes filesystem read-only except allowed paths
- `ProtectHome=true` blocks access to user home directories
- `PrivateTmp=true` isolates /tmp namespace
- Environment file readable only by root and service group

## Next Steps
Proceed to Phase 04 (Nginx Configuration)
