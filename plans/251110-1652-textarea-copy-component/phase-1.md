# Phase 1: UI Design & Integration

## Objective
Create textarea component and copy button that seamlessly integrates with existing design system.

## Tasks

### 1.1 Textarea Component Design
**File: `/public/index.html`**
- Add textarea element to result section
- Include proper labeling for accessibility
- Set initial styling classes

**Implementation:**
```html
<div class="text-display-section" id="textDisplaySection" style="display: none;">
    <div class="text-display-container">
        <label for="extractedText" class="text-display-label">
            Extracted Text
        </label>
        <textarea
            id="extractedText"
            class="extracted-text-area"
            readonly
            rows="12"
            placeholder="Extracted text will appear here..."
            aria-label="Extracted text from PDF document">
        </textarea>
        <div class="text-actions">
            <button id="copyTextBtn" class="copy-btn" type="button">
                <span class="copy-icon">📋</span>
                <span class="copy-text">Copy Text</span>
            </button>
            <button id="downloadTextBtn" class="download-btn secondary-btn" type="button">
                <span class="download-icon">⬇️</span>
                <span class="download-text">Download</span>
            </button>
        </div>
    </div>
</div>
```

### 1.2 CSS Styling
**File: `/public/styles.css`**

Add component styles:
```css
/* Text Display Section */
.text-display-section {
    margin-bottom: 30px;
}

.text-display-container {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 25px;
    border: 1px solid #e9ecef;
}

.text-display-label {
    display: block;
    font-weight: 600;
    color: #333;
    margin-bottom: 10px;
    font-size: 1rem;
}

.extracted-text-area {
    width: 100%;
    min-height: 200px;
    max-height: 400px;
    padding: 15px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    background: white;
    resize: vertical;
    margin-bottom: 15px;
    transition: border-color 0.3s ease;
}

.extracted-text-area:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.text-actions {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
}

.copy-btn {
    background: #28a745;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: center;
    min-width: 120px;
}

.copy-btn:hover {
    background: #218838;
    transform: translateY(-2px);
}

.copy-btn:active {
    transform: translateY(0);
}

.copy-btn.copied {
    background: #17a2b8;
    animation: pulse 0.5s ease;
}

.download-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: center;
    min-width: 120px;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

/* Mobile responsive */
@media (max-width: 768px) {
    .text-actions {
        flex-direction: column;
    }

    .copy-btn,
    .download-btn {
        width: 100%;
    }

    .extracted-text-area {
        min-height: 150px;
        font-size: 0.85rem;
    }
}
```

### 1.3 Integration Points
**File: `/public/index.html`**
- Add text display section after progress section
- Update result section to show both preview and download options
- Ensure proper z-index and positioning

### 1.4 Accessibility Enhancements
- Add proper ARIA labels
- Ensure keyboard navigation
- Include screen reader announcements
- Meet WCAG 2.1 AA standards

## Expected Outcome
- Textarea component styled consistently with existing design
- Copy and download buttons ready for functionality
- Responsive layout working on all devices
- Accessible to assistive technologies