# PDF OCR Application

Simple frontend application for extracting Vietnamese text from scanned PDF documents using Tesseract OCR.

## Features
- Upload scanned PDF files
- Convert PDF to images
- Extract Vietnamese text using Tesseract OCR
- Download extracted text as .txt file

## Requirements
- Node.js 18+
- Tesseract OCR with Vietnamese language pack
- poppler-utils for PDF processing

## Installation
```bash
npm install
brew install tesseract tesseract-lang
```

## Usage
```bash
npm start
```
Server runs on port 3847

## Tech Stack
- Frontend: Vanilla HTML/CSS/JS
- Backend: Node.js + Express
- PDF Processing: pdf-poppler
- OCR: node-tesseract-ocr