# Phase 3: PDF Processing and OCR Integration

## Objectives
- Implement PDF to image conversion
- Integrate Tesseract OCR for Vietnamese text
- Process multiple pages sequentially
- Combine extracted text from all pages

## Tasks

### 3.1 PDF to Image Conversion
```javascript
const pdf2img = require('pdf-to-img');

const convertPdfToImages = async (pdfPath) => {
  try {
    const outputDir = path.join(__dirname, 'temp', Date.now().toString());
    await fs.ensureDir(outputDir);

    const images = await pdf2img.convert(pdfPath, {
      type: 'png',
      size: 2048,
      density: 300,
      quality: 100,
      output_dir: outputDir,
      output_name: 'page'
    });

    return images;
  } catch (error) {
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
};
```

### 3.2 Tesseract OCR Integration
```javascript
const tesseract = require('node-tesseract-ocr');

const extractTextFromImage = async (imagePath) => {
  try {
    const config = {
      lang: 'vie', // Vietnamese language pack
      oem: 1,
      psm: 3,
    };

    const text = await tesseract.recognize(imagePath, config);
    return text;
  } catch (error) {
    throw new Error(`OCR failed: ${error.message}`);
  }
};
```

### 3.3 Main Processing Function
```javascript
const processPdfOcr = async (pdfPath) => {
  let tempFiles = [];

  try {
    // Convert PDF to images
    const images = await convertPdfToImages(pdfPath);
    tempFiles.push(...images);

    // Process each image with OCR
    const textResults = [];
    for (const imagePath of images) {
      const text = await extractTextFromImage(imagePath);
      textResults.push(text);
    }

    // Combine all text
    const combinedText = textResults
      .map((text, index) => `--- Page ${index + 1} ---\n${text}`)
      .join('\n\n');

    return combinedText;
  } finally {
    // Cleanup temporary files
    await cleanupFiles(tempFiles);
  }
};
```

### 3.4 Upload Route Enhancement
```javascript
app.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const extractedText = await processPdfOcr(req.file.path);

    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.json({
      success: true,
      text: extractedText,
      filename: `${req.file.originalname}_extracted.txt`
    });
  } catch (error) {
    // Cleanup on error
    await fs.remove(req.file.path);
    res.status(500).json({ error: error.message });
  }
});
```

### 3.5 Text Download Endpoint
```javascript
app.post('/download', express.text(), (req, res) => {
  const text = req.body;
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `extracted_text_${timestamp}.txt`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(text);
});
```

## Acceptance Criteria
- PDF files convert to images successfully
- Tesseract OCR processes Vietnamese text
- Multiple pages handled sequentially
- Text from all pages combined properly
- Temporary files cleaned up after processing
- Error handling for conversion and OCR failures
- Download endpoint provides text file

## Key Components
- PDF to image conversion utility
- OCR processing with Vietnamese language
- Multi-page text combination
- Enhanced upload route with OCR
- Text download functionality
- Comprehensive error handling

## Testing
- Single page PDF processed correctly
- Multi-page PDF handled properly
- Vietnamese text extracted accurately
- Temporary files cleaned up
- Error scenarios handled gracefully
- Download generates valid text file

## Next Phase
Proceed to Phase 4: Frontend Interface Implementation