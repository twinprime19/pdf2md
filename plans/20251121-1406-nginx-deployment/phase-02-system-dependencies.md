# Phase 02: System Dependencies Setup

## Context
- **Parent**: [plan.md](./plan.md)
- **Dependencies**: None (run first on fresh server)
- **Related**: [researcher-02-nodejs-packaging.md](./research/researcher-02-nodejs-packaging.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-11-21 |
| Priority | Critical |
| Status | Pending |
| Description | Install Tesseract OCR, Poppler utils, and Node.js on Ubuntu server |

## Key Insights
- Vietnamese language pack (`tesseract-ocr-vie`) required
- Poppler provides `pdftoppm` for PDF-to-image conversion
- Node.js 18+ required for ES modules support
- All deps must be available to service user

## Requirements
1. Node.js 18+ LTS
2. Tesseract OCR with Vietnamese language pack
3. Poppler utilities (pdftoppm)
4. Dedicated service user

## Implementation Steps

### Step 1: Create service user
```bash
sudo useradd -r -s /bin/false -d /opt/pdf-ocr pdf-ocr
```

### Step 2: Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Verify: v20.x
```

### Step 3: Install Tesseract OCR with Vietnamese
```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-vie

# Verify
tesseract --version
tesseract --list-langs | grep vie
```

### Step 4: Install Poppler utilities
```bash
sudo apt-get install -y poppler-utils

# Verify
pdftoppm -v
```

### Step 5: Create application directories
```bash
sudo mkdir -p /opt/pdf-ocr
sudo mkdir -p /etc/pdf-ocr
sudo chown -R pdf-ocr:pdf-ocr /opt/pdf-ocr
sudo chmod 750 /opt/pdf-ocr
sudo chmod 700 /etc/pdf-ocr
```

### Step 6: Verify all dependencies
```bash
# Run as pdf-ocr user to confirm access
sudo -u pdf-ocr bash -c '
  echo "Node: $(node --version)"
  echo "Tesseract: $(tesseract --version | head -1)"
  echo "Poppler: $(pdftoppm -v 2>&1 | head -1)"
  tesseract --list-langs | grep -q vie && echo "Vietnamese: OK"
'
```

## Full Installation Script
```bash
#!/bin/bash
set -e

echo "=== Installing PDF OCR Dependencies ==="

# Service user
sudo useradd -r -s /bin/false -d /opt/pdf-ocr pdf-ocr 2>/dev/null || true

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# OCR dependencies
sudo apt-get update
sudo apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-vie \
  poppler-utils

# Directories
sudo mkdir -p /opt/pdf-ocr /etc/pdf-ocr
sudo chown -R pdf-ocr:pdf-ocr /opt/pdf-ocr
sudo chmod 750 /opt/pdf-ocr
sudo chmod 700 /etc/pdf-ocr

echo "=== Verification ==="
node --version
tesseract --list-langs | grep vie
which pdftoppm

echo "=== Dependencies installed successfully ==="
```

## Todo
- [ ] Create service user
- [ ] Install Node.js 20 LTS
- [ ] Install Tesseract + Vietnamese pack
- [ ] Install Poppler utilities
- [ ] Create application directories
- [ ] Verify all dependencies

## Success Criteria
- [ ] `node --version` returns v20.x
- [ ] `tesseract --list-langs` includes `vie`
- [ ] `which pdftoppm` returns path
- [ ] `/opt/pdf-ocr` owned by pdf-ocr user

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Package repo unavailable | High | Use alternate mirrors |
| Version conflicts | Medium | Pin specific versions |
| Permission issues | Medium | Verify as service user |

## Security Considerations
- Service user has no login shell (`/bin/false`)
- Minimal permissions on directories
- Environment secrets in `/etc/pdf-ocr/` (root-only)

## Next Steps
Proceed to Phase 01 (Build) or Phase 03 (Systemd)
