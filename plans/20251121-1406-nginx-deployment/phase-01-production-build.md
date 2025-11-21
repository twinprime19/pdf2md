# Phase 01: Production Build Preparation

## Context
- **Parent**: [plan.md](./plan.md)
- **Dependencies**: None
- **Related**: [researcher-02-nodejs-packaging.md](./research/researcher-02-nodejs-packaging.md)

## Overview
| Field | Value |
|-------|-------|
| Date | 2025-11-21 |
| Priority | High |
| Status | Pending |
| Description | Configure npm scripts, environment variables, and production build process |

## Key Insights
- Use `npm ci --production` for deterministic installs
- Validate env vars on startup to fail fast
- Add graceful shutdown handler for OCR jobs
- Trust proxy header for correct client IP logging

## Requirements
1. Production npm script with proper NODE_ENV
2. Environment file template with all required vars
3. Graceful shutdown handling for SIGTERM
4. Dependency verification on startup

## Architecture
```
/opt/pdf-ocr/
├── server.js
├── ocr-processor.js
├── streaming-processor.js
├── checkpoint-manager.js
├── public/
├── temp/           # Created at runtime
├── checkpoints/    # Created at runtime
├── package.json
└── node_modules/
```

## Related Code Files
- `/Users/luan/tesse/server.js` - Main entry point
- `/Users/luan/tesse/package.json` - Scripts configuration
- `/Users/luan/tesse/verify-setup.js` - Dependency verification

## Implementation Steps

### Step 1: Add production npm script
Update `package.json`:
```json
{
  "scripts": {
    "start": "node server.js",
    "start:prod": "NODE_ENV=production node server.js",
    "verify": "node verify-setup.js"
  }
}
```

### Step 2: Create environment template
Create `.env.production.template`:
```bash
# Server
NODE_ENV=production
PORT=3847

# Streaming (optional)
ENABLE_STREAMING=true
STREAMING_THRESHOLD_MB=10
MAX_MEMORY_MB=1024
CHECKPOINT_INTERVAL=10
CHECKPOINT_RETENTION_DAYS=7

# Logging
LOG_LEVEL=info
```

### Step 3: Add trust proxy to server.js
```javascript
// After app initialization
app.set('trust proxy', 1);
```

### Step 4: Enhance graceful shutdown
Update SIGINT handler in server.js to handle SIGTERM:
```javascript
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, shutting down...`);

  // Stop accepting new requests
  server.close(async () => {
    // Wait for pending OCR jobs (max 30s)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Cleanup temp files
    try {
      const tempDir = 'temp';
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
    } catch (e) { /* ignore */ }

    process.exit(0);
  });

  // Force exit after 30s
  setTimeout(() => process.exit(1), 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Step 5: Add startup dependency check
Add to server.js after imports:
```javascript
import { execSync } from 'child_process';

function verifyDependencies() {
  const deps = ['tesseract', 'pdftoppm'];
  for (const cmd of deps) {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
    } catch {
      console.error(`FATAL: Missing dependency: ${cmd}`);
      process.exit(1);
    }
  }
  console.log('System dependencies verified');
}

if (process.env.NODE_ENV === 'production') {
  verifyDependencies();
}
```

## Todo
- [ ] Update package.json with prod scripts
- [ ] Create .env.production.template
- [ ] Add trust proxy setting
- [ ] Implement graceful shutdown
- [ ] Add startup dependency verification

## Success Criteria
- [ ] `npm run start:prod` works correctly
- [ ] App fails fast if Tesseract/Poppler missing
- [ ] SIGTERM triggers graceful shutdown
- [ ] Environment template documents all vars

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing deps at runtime | High | Fail-fast verification |
| Env var misconfiguration | Medium | Template + validation |
| Orphaned OCR processes | Medium | Graceful shutdown timeout |

## Security Considerations
- Never commit `.env.production` (only template)
- Use systemd EnvironmentFile for secrets
- Validate file paths to prevent traversal

## Next Steps
Proceed to Phase 02 (System Dependencies) or Phase 03 (Systemd Service)
