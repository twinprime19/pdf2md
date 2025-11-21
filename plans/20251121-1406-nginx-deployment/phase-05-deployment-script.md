# Phase 05: Deployment Script

## Context
- **Parent**: [plan.md](./plan.md)
- **Dependencies**: Phase 01-04
- **Related**: All research reports

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-11-21 |
| Priority | Medium |
| Status | Pending |
| Description | Create automated deployment script for initial setup and updates |

## Key Insights
- Single script handles fresh install and updates
- `npm ci --production` for deterministic builds
- Backup current deployment before update
- Health check verification after deploy

## Requirements
1. Fresh server setup (first-time deploy)
2. Application updates (subsequent deploys)
3. Rollback capability
4. Health verification after deploy

## Implementation Steps

### Step 1: Create deploy.sh
Save as `/opt/pdf-ocr/deploy.sh` or in project repo:

```bash
#!/bin/bash
set -e

# Configuration
APP_NAME="pdf-ocr"
APP_DIR="/opt/pdf-ocr"
APP_USER="pdf-ocr"
REPO_URL="https://github.com/your-repo/pdf-ocr.git"  # Update this
BRANCH="${1:-main}"
BACKUP_DIR="/opt/pdf-ocr-backups"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root
[[ $EUID -ne 0 ]] && error "Run as root: sudo $0"

log "=== Deploying $APP_NAME (branch: $BRANCH) ==="

# Backup current deployment
if [[ -d "$APP_DIR/node_modules" ]]; then
    log "Backing up current deployment..."
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$APP_DIR" . --exclude='temp/*' --exclude='checkpoints/*'
    log "Backup saved: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
fi

# Pull latest code
if [[ -d "$APP_DIR/.git" ]]; then
    log "Pulling latest changes..."
    cd "$APP_DIR"
    sudo -u "$APP_USER" git fetch origin
    sudo -u "$APP_USER" git checkout "$BRANCH"
    sudo -u "$APP_USER" git pull origin "$BRANCH"
else
    log "Cloning repository..."
    rm -rf "$APP_DIR"
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# Install dependencies
log "Installing dependencies..."
cd "$APP_DIR"
sudo -u "$APP_USER" npm ci --production

# Create runtime directories
log "Creating runtime directories..."
mkdir -p "$APP_DIR/temp" "$APP_DIR/checkpoints"
chown "$APP_USER:$APP_USER" "$APP_DIR/temp" "$APP_DIR/checkpoints"

# Restart service
log "Restarting service..."
systemctl daemon-reload
systemctl restart "$APP_NAME"

# Wait for startup
log "Waiting for service startup..."
sleep 3

# Health check
log "Verifying deployment..."
for i in {1..10}; do
    if curl -sf http://localhost:3847/health > /dev/null; then
        log "Health check passed!"
        break
    fi
    if [[ $i -eq 10 ]]; then
        error "Health check failed after 10 attempts"
    fi
    warn "Health check attempt $i failed, retrying..."
    sleep 2
done

# Show status
systemctl status "$APP_NAME" --no-pager

log "=== Deployment complete ==="
log "View logs: journalctl -u $APP_NAME -f"
```

### Step 2: Create rollback.sh
```bash
#!/bin/bash
set -e

APP_NAME="pdf-ocr"
APP_DIR="/opt/pdf-ocr"
BACKUP_DIR="/opt/pdf-ocr-backups"

[[ $EUID -ne 0 ]] && { echo "Run as root"; exit 1; }

# List backups
echo "Available backups:"
ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null || { echo "No backups found"; exit 1; }

# Get backup file
BACKUP_FILE="${1:-$(ls -t $BACKUP_DIR/*.tar.gz | head -1)}"
[[ ! -f "$BACKUP_FILE" ]] && { echo "Backup not found: $BACKUP_FILE"; exit 1; }

echo "Rolling back to: $BACKUP_FILE"

# Stop service
systemctl stop "$APP_NAME"

# Restore backup
cd "$APP_DIR"
rm -rf node_modules package-lock.json
tar -xzf "$BACKUP_FILE" -C "$APP_DIR"

# Restart
systemctl start "$APP_NAME"
sleep 3

# Verify
curl -sf http://localhost:3847/health && echo "Rollback successful!" || echo "Rollback may have failed"
```

### Step 3: Create first-time setup script
```bash
#!/bin/bash
# setup-server.sh - Run once on fresh server
set -e

echo "=== PDF OCR Server Setup ==="

# Install dependencies (Phase 02)
sudo useradd -r -s /bin/false -d /opt/pdf-ocr pdf-ocr 2>/dev/null || true

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx tesseract-ocr tesseract-ocr-vie poppler-utils

# Create directories
sudo mkdir -p /opt/pdf-ocr /etc/pdf-ocr /opt/pdf-ocr-backups
sudo chown pdf-ocr:pdf-ocr /opt/pdf-ocr
sudo chmod 750 /opt/pdf-ocr

# Create environment file
cat << 'EOF' | sudo tee /etc/pdf-ocr/.env.production
NODE_ENV=production
PORT=3847
ENABLE_STREAMING=true
STREAMING_THRESHOLD_MB=10
MAX_MEMORY_MB=1024
LOG_LEVEL=info
EOF
sudo chown root:pdf-ocr /etc/pdf-ocr/.env.production
sudo chmod 640 /etc/pdf-ocr/.env.production

# Copy systemd service (from Phase 03)
# Copy nginx config (from Phase 04)

echo "=== Setup complete. Run deploy.sh to deploy application ==="
```

### Step 4: Make scripts executable
```bash
chmod +x deploy.sh rollback.sh setup-server.sh
```

## Usage
```bash
# First-time server setup
sudo ./setup-server.sh

# Deploy (default: main branch)
sudo ./deploy.sh

# Deploy specific branch
sudo ./deploy.sh feature/streaming

# Rollback to latest backup
sudo ./rollback.sh

# Rollback to specific backup
sudo ./rollback.sh /opt/pdf-ocr-backups/backup-20251121-140600.tar.gz
```

## Todo
- [ ] Create deploy.sh script
- [ ] Create rollback.sh script
- [ ] Create setup-server.sh script
- [ ] Test fresh deployment
- [ ] Test update deployment
- [ ] Test rollback

## Success Criteria
- [ ] Fresh deploy works on new server
- [ ] Update deploy preserves data (checkpoints)
- [ ] Rollback restores previous version
- [ ] Health check verifies deployment
- [ ] Backup created before each update

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Failed deploy | High | Automatic rollback available |
| Lost checkpoints | Medium | Exclude from backup overwrite |
| npm ci failure | Medium | Keep previous node_modules backup |

## Security Considerations
- Scripts require root (sudo)
- Backups don't include secrets (.env)
- Git pull as service user, not root
- Health check validates app is running

## Next Steps
Test full deployment cycle on staging server before production.
