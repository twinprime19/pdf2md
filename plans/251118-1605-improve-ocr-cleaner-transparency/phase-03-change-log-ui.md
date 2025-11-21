# Phase 3: Build Change Log UI

## Context Links

- **Parent Plan:** `plan.md`
- **Dependencies:** Phase 2 (detailed change tracking)
- **Related Files:** `public/index.html`, `public/app.js`, `public/styles.css`
- **Related Issue:** No transparency in what corrections were made

## Overview

**Date:** 2025-11-18
**Description:** Display scrollable corrections log at bottom of interface
**Priority:** Medium
**Implementation Status:** 🔵 Not Started
**Review Status:** 🟡 Pending Review
**Estimated Time:** 1 hour

## Design Requirements

### User Needs
1. See what was corrected
2. Verify corrections are accurate
3. Understand cleaning quality
4. Audit for errors

### UI Requirements
- Display below metadata section
- Collapsible (starts collapsed)
- Scrollable (max 300px height)
- Grouped by category
- Before → After format
- Context preview on hover

## UI Design

### Layout Structure

```
┌─────────────────────────────────────────────┐
│  Metadata Section (existing)                │
│  • Doc Type • Corrections • Confidence      │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│  📝 Corrections Log (147 total) [▼]         │
├─────────────────────────────────────────────┤
│  ⚙️ Vietnamese Character Fixes (47)         │
│    "Dia chi" → "Địa chỉ"                    │
│    "Dien thoai" → "Điện thoại"              │
│    ... (45 more)                            │
│                                             │
│  ⚙️ Core Vocabulary Fixes (85)              │
│    "Cong ty" → "Công ty"                    │
│    "Giam doc" → "Giám đốc"                  │
│    ... (83 more)                            │
│                                             │
│  ⚙️ Legal Vocabulary Fixes (15)             │
│    "hop dong" → "hợp đồng"                  │
│    ... (14 more)                            │
└─────────────────────────────────────────────┘
```

### Component Breakdown

**1. Header with Toggle**
- Total corrections count
- Expand/collapse button
- Category indicators

**2. Category Sections**
- Grouped by type
- Category name + count
- Collapsible subsections

**3. Correction Items**
- Before text (muted)
- Arrow separator
- After text (highlighted)
- Context on hover (tooltip)

## Implementation Steps

### Step 1: Add HTML Structure

**File:** `public/index.html`
**Location:** After `.metadata-section` (around line 95)

**Insert:**
```html
<!-- Corrections Log Section -->
<div class="corrections-section" id="correctionsSection" style="display: none;">
    <div class="corrections-header" onclick="toggleCorrectionsLog()">
        <h4>
            📝 Corrections Made
            <span id="totalCorrectionsCount">(0)</span>
        </h4>
        <button class="toggle-btn" id="correctionsToggle">▼</button>
    </div>

    <div class="corrections-content" id="correctionsContent">
        <div id="correctionsList">
            <!-- Dynamically populated -->
        </div>
    </div>
</div>
```

### Step 2: Add CSS Styling

**File:** `public/styles.css`
**Location:** After `.metadata-section` styles (around line 448)

**Add:**
```css
/* Corrections Log Section */
.corrections-section {
    margin-top: 20px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 12px;
    border: 1px solid #e9ecef;
    animation: fadeIn 0.5s ease;
}

.corrections-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
    padding-bottom: 15px;
    border-bottom: 1px solid #dee2e6;
}

.corrections-header h4 {
    margin: 0;
    font-size: 1rem;
    color: #333;
}

.corrections-header h4 span {
    color: #667eea;
    font-weight: 700;
}

.toggle-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: #667eea;
    cursor: pointer;
    padding: 5px 10px;
    transition: transform 0.3s ease;
    width: auto;
}

.toggle-btn.collapsed {
    transform: rotate(-90deg);
}

.corrections-content {
    max-height: 400px;
    overflow-y: auto;
    margin-top: 15px;
    transition: max-height 0.3s ease;
}

.corrections-content.collapsed {
    max-height: 0;
    overflow: hidden;
    margin-top: 0;
}

/* Category Groups */
.correction-category {
    margin-bottom: 20px;
}

.category-title {
    font-weight: 600;
    color: #495057;
    font-size: 0.9rem;
    margin-bottom: 10px;
    padding: 8px 12px;
    background: #e9ecef;
    border-radius: 6px;
}

/* Individual Correction Items */
.correction-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    margin-bottom: 5px;
    background: white;
    border-radius: 6px;
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.85rem;
    transition: background 0.2s ease;
}

.correction-item:hover {
    background: #f0f4ff;
}

.correction-before {
    color: #dc3545;
    text-decoration: line-through;
    opacity: 0.7;
}

.correction-arrow {
    color: #667eea;
    font-weight: bold;
}

.correction-after {
    color: #28a745;
    font-weight: 600;
}

.correction-context {
    display: none;
    position: absolute;
    background: #333;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    max-width: 300px;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.correction-item:hover .correction-context {
    display: block;
}

/* Scrollbar styling */
.corrections-content::-webkit-scrollbar {
    width: 8px;
}

.corrections-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.corrections-content::-webkit-scrollbar-thumb {
    background: #667eea;
    border-radius: 4px;
}

.corrections-content::-webkit-scrollbar-thumb:hover {
    background: #5a67d8;
}

/* Responsive */
@media (max-width: 768px) {
    .corrections-content {
        max-height: 300px;
    }

    .correction-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
    }
}
```

### Step 3: Add JavaScript Functions

**File:** `public/app.js`
**Location:** After `formatDocumentType()` function (around line 652)

**Add:**
```javascript
/**
 * Toggle corrections log visibility
 */
function toggleCorrectionsLog() {
    const content = document.getElementById('correctionsContent');
    const toggleBtn = document.getElementById('correctionsToggle');

    content.classList.toggle('collapsed');
    toggleBtn.classList.toggle('collapsed');
}

/**
 * Display corrections log from metadata
 * @param {Object} metadata - Cleaning metadata with changes
 */
function displayCorrectionsLog(metadata) {
    const section = document.getElementById('correctionsSection');
    const totalCount = document.getElementById('totalCorrectionsCount');
    const correctionsList = document.getElementById('correctionsList');

    // Calculate total corrections
    const total = metadata.totalCorrections || metadata.changesCount || 0;
    totalCount.textContent = `(${total} total)`;

    // Clear previous content
    correctionsList.innerHTML = '';

    // Group and display corrections by category
    const categories = {
        'vietnamese_char_fix': '⚙️ Vietnamese Character Fixes',
        'core_vocabulary_fix': '📚 Core Vocabulary Fixes',
        'legal_vocabulary': '⚖️ Legal Vocabulary Fixes',
        'mechanical_artifact_removal': '🔧 Artifact Removal',
        'whitespace_normalization': '📏 Whitespace Normalization',
        'number_formatting': '🔢 Number Formatting'
    };

    metadata.changes.forEach(change => {
        if (!change.details || change.details.length === 0) return;

        // Create category section
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'correction-category';

        // Category title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'category-title';
        const categoryName = categories[change.type] || change.type;
        titleDiv.textContent = `${categoryName} (${change.count})`;
        categoryDiv.appendChild(titleDiv);

        // Add correction items
        change.details.forEach(detail => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'correction-item';

            itemDiv.innerHTML = `
                <span class="correction-before">${escapeHtml(detail.before)}</span>
                <span class="correction-arrow">→</span>
                <span class="correction-after">${escapeHtml(detail.after)}</span>
                ${detail.context ? `<span class="correction-context">${escapeHtml(detail.context)}</span>` : ''}
            `;

            categoryDiv.appendChild(itemDiv);
        });

        // Show "and X more" if capped
        if (change.remaining > 0) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'correction-item';
            moreDiv.style.opacity = '0.6';
            moreDiv.innerHTML = `
                <span>... and ${change.remaining} more ${categoryName.toLowerCase()}</span>
            `;
            categoryDiv.appendChild(moreDiv);
        }

        correctionsList.appendChild(categoryDiv);
    });

    // Show section
    section.style.display = 'block';

    // Start collapsed on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('correctionsContent').classList.add('collapsed');
        document.getElementById('correctionsToggle').classList.add('collapsed');
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

### Step 4: Integrate with showSuccess()

**File:** `public/app.js`
**Lines:** 250-268

**Update:**
```javascript
function showSuccess(data) {
    processingTime.textContent = `Processing time: ${(data.processingTime / 1000).toFixed(1)}s`;
    pageCount.textContent = `File: ${data.filename} (${data.pages} pages)`;
    resultSection.style.display = 'block';

    // Display both original and cleaned text in textareas
    if (data.original && data.cleaned) {
        document.getElementById('originalText').value = data.original;
        document.getElementById('cleanedText').value = data.cleaned;
        document.getElementById('textPreview').style.display = 'block';

        // Update metadata display
        document.getElementById('docType').textContent = formatDocumentType(data.metadata.documentType);
        document.getElementById('corrections').textContent = data.metadata.totalCorrections || data.metadata.changesCount || 0;  // ← Use totalCorrections
        document.getElementById('confidence').textContent = Math.round((data.metadata.confidence || 0) * 100);
        document.getElementById('ocrTime').textContent = data.ocrTime || 0;
        document.getElementById('cleanTime').textContent = data.cleaningTime || 0;

        // NEW: Display corrections log
        displayCorrectionsLog(data.metadata);
    }
}
```

### Step 5: Add to resetUI()

**File:** `public/app.js`
**Lines:** 289-317

**Add:**
```javascript
function resetUI() {
    // Reset form
    uploadForm.reset();
    selectedFile = null;
    isProcessing = false;

    // Reset UI elements
    resetFileInfo();
    hideAllSections();

    // NEW: Hide corrections log
    document.getElementById('correctionsSection').style.display = 'none';

    // ... rest of resetUI()
}
```

## Testing Strategy

### Visual Testing

**Test Cases:**
1. **Display with 50 corrections**
   - Verify all 50 shown
   - Check grouping by category
   - Validate before → after format

2. **Display with 150 corrections**
   - Verify first 100 shown per category
   - Check "and 50 more" message
   - Validate performance (no lag)

3. **Toggle functionality**
   - Click header to collapse/expand
   - Verify smooth animation
   - Check button rotation

4. **Mobile responsive**
   - Test on <768px screen
   - Verify vertical layout
   - Check scrolling works

### Functional Testing

**Interactions:**
- Hover over item → Context tooltip appears
- Click toggle → Content collapses/expands
- Scroll corrections → Smooth scrolling
- Reset UI → Corrections hidden

### Performance Testing

**Benchmarks:**
- 50 corrections: Render <50ms
- 100 corrections: Render <100ms
- 200 corrections (capped): Render <150ms

## Success Criteria

### Visual Quality
- ✅ Corrections clearly visible
- ✅ Before/after easy to compare
- ✅ Categories well organized
- ✅ Professional, clean design

### Functionality
- ✅ Toggle works smoothly
- ✅ Scroll works for long lists
- ✅ Context tooltips display
- ✅ Mobile responsive

### User Experience
- ✅ Users understand corrections made
- ✅ Trust in cleaning quality increases
- ✅ Can audit for errors
- ✅ No UI clutter

## Risk Assessment

**Risks:**

1. **UI Clutter**
   - **Risk:** Too much information overwhelming
   - **Mitigation:** Start collapsed, limit to 100 items
   - **Severity:** Low

2. **Performance with Many Items**
   - **Risk:** DOM rendering lag
   - **Mitigation:** Virtual scrolling if needed
   - **Severity:** Low

3. **Mobile UX**
   - **Risk:** Cramped on small screens
   - **Mitigation:** Responsive design, starts collapsed
   - **Severity:** Very Low

**Overall Risk:** **Very Low** (Progressive disclosure, tested patterns)

## Accessibility Considerations

**WCAG Compliance:**
- ✅ Keyboard navigable (toggle button)
- ✅ Screen reader friendly (semantic HTML)
- ✅ Color contrast (green/red with text)
- ✅ Focus indicators on interactive elements

## Todo List

- [ ] Add HTML structure to index.html
- [ ] Add CSS styles to styles.css
- [ ] Add JavaScript functions to app.js
- [ ] Integrate with showSuccess()
- [ ] Update resetUI()
- [ ] Test with 50 corrections
- [ ] Test with 150 corrections
- [ ] Test toggle functionality
- [ ] Test mobile responsive
- [ ] Verify accessibility
- [ ] Commit Phase 3 changes

## Next Steps

**After Phase 3:**
- User testing and feedback
- Iterate on UI based on feedback
- Consider adding filters/search
- Document feature in README

## Future Enhancements (Out of Scope)

- Search/filter corrections
- Export corrections log as CSV
- Visual diff highlighting in textareas
- Undo specific corrections

## Unresolved Questions

1. **Should corrections start expanded or collapsed?**
   - Current plan: Collapsed (less clutter)
   - Alternative: Expanded (immediate visibility)

2. **Should we add category icons?**
   - Current plan: Yes (⚙️📚⚖️)
   - Alternative: Text only

3. **Maximum height for scrolling?**
   - Current plan: 400px desktop, 300px mobile
   - Alternative: Dynamic based on viewport
