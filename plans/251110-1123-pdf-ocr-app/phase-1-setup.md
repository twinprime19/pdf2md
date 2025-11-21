# Phase 1: Project Setup and Dependencies

## Objectives
- Initialize Node.js project
- Install required dependencies
- Configure project structure
- Set up Tesseract Vietnamese language pack

## Tasks

### 1.1 Project Initialization
```bash
mkdir pdf-ocr-app
cd pdf-ocr-app
npm init -y
```

### 1.2 Core Dependencies Installation
```bash
npm install express multer pdf-to-img node-tesseract-ocr fs-extra
npm install --save-dev nodemon
```

### 1.3 Directory Structure Setup
```bash
mkdir public uploads temp
touch server.js
touch public/index.html public/styles.css public/script.js
```

### 1.4 Tesseract Vietnamese Language Pack
```bash
# Install tesseract system dependency (macOS)
brew install tesseract tesseract-lang

# Verify Vietnamese language pack
tesseract --list-langs | grep vie
```

### 1.5 Package.json Scripts
Add to package.json:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

## Acceptance Criteria
- Project initialized with proper package.json
- All dependencies installed successfully
- Directory structure created
- Tesseract with Vietnamese language pack available
- Development scripts configured

## Files Created/Modified
- `package.json`
- `server.js` (empty)
- `public/index.html` (empty)
- `public/styles.css` (empty)
- `public/script.js` (empty)
- Directory structure complete

## Next Phase
Proceed to Phase 2: Backend Server Implementation