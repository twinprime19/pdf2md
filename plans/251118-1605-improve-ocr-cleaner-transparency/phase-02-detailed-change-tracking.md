# Phase 2: Add Detailed Change Tracking

## Context Links

- **Parent Plan:** `plan.md`
- **Dependencies:** Phase 1 (whitespace fixes)
- **Related Docs:** `cleaner.service.js`, `ocr-processor.js`
- **Related Issue:** Inaccurate correction count (reports 7, actual 47+)

## Overview

**Date:** 2025-11-18
**Description:** Track individual corrections with before/after details
**Priority:** High
**Implementation Status:** 🔵 Not Started
**Review Status:** 🟡 Pending Review
**Estimated Time:** 1.5 hours

## Problem Analysis

### Current Tracking (Inadequate)

**Generic change types:**
```javascript
changes.push({ type: 'vietnamese_char_fix', count: 47 });
changes.push({ type: 'mechanical_artifact_removal' });
changes.push({ type: 'whitespace_normalization' });
```

**Metadata returned:**
```javascript
{
  changesCount: 3,  // ← Only 3 categories, not 47 corrections!
  changes: [
    { type: 'vietnamese_char_fix', count: 47 },
    { type: 'mechanical_artifact_removal' },
    { type: 'whitespace_normalization' }
  ]
}
```

### Problems

1. **Misleading Count:** `changesCount: 3` when 47+ corrections made
2. **No Details:** Can't see what was changed
3. **No Context:** Where in document changes occurred
4. **No Verification:** Can't audit corrections
5. **User Mistrust:** "Black box" cleaning

## Solution Design

### Detailed Change Structure

```javascript
{
  type: 'vietnamese_char',
  category: 'character_fix',
  before: 'Dia chi',
  after: 'Địa chỉ',
  position: 145,            // Character position
  context: '...Thong tin: Dia chi: 123...',  // ±20 chars
  confidence: 0.95          // How certain is correction
}
```

### Performance Considerations

**Limits:**
- Max 100 detailed changes per category (prevent bloat)
- Store first 100, count all
- Example: "47 Vietnamese fixes (showing first 100)"

**Data Structure:**
```javascript
{
  totalCorrections: 147,     // Accurate total
  changesCount: 3,           // Categories (backward compat)
  changes: [
    {
      type: 'vietnamese_char_fix',
      count: 47,
      details: [              // First 100 only
        { before: '...', after: '...', ... },
        // ... 99 more
      ],
      remaining: 0            // 47 shown, 0 hidden
    },
    {
      type: 'core_vocabulary',
      count: 85,
      details: [ /* 100 items */ ],
      remaining: 0            // All 85 shown
    },
    {
      type: 'legal_vocabulary',
      count: 15,
      details: [ /* 15 items */ ],
      remaining: 0
    }
  ]
}
```

## Implementation Steps

### Step 1: Add Helper Method for Context Extraction

**File:** `cleaner.service.js`
**Location:** After `_extract()` method (around line 863)

**New method:**
```javascript
/**
 * Extract surrounding context for a match
 * @param {string} text - Full text
 * @param {string} match - Matched substring
 * @param {number} contextLength - Characters before/after (default 20)
 * @returns {string} Context snippet
 */
_getContext(text, match, contextLength = 20) {
  const index = text.indexOf(match);
  if (index === -1) return match;

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + match.length + contextLength);

  let context = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context;
}
```

### Step 2: Modify `_fixVietnameseCharacters()`

**File:** `cleaner.service.js`
**Lines:** 600-617

**Before:**
```javascript
_fixVietnameseCharacters(text) {
  let result = text;
  const changes = [];
  let fixCount = 0;

  this.vietnameseCharFixes.forEach(({ pattern, replacement }) => {
    const matches = result.match(pattern);
    if (matches) {
      result = result.replace(pattern, replacement);
      fixCount += matches.length;
    }
  });

  if (fixCount > 0) {
    changes.push({ type: 'vietnamese_char_fix', count: fixCount });
  }

  return { text: result, changes };
}
```

**After:**
```javascript
_fixVietnameseCharacters(text) {
  let result = text;
  const changes = [];
  let fixCount = 0;
  const detailedChanges = [];  // NEW: Track details
  const MAX_DETAILS = 100;      // Limit for performance

  this.vietnameseCharFixes.forEach(({ pattern, replacement }) => {
    const matches = result.match(pattern);
    if (matches) {
      // Track details for each match
      matches.forEach(match => {
        if (detailedChanges.length < MAX_DETAILS) {
          detailedChanges.push({
            type: 'vietnamese_char',
            before: match,
            after: typeof replacement === 'function'
              ? replacement(match)
              : replacement,
            context: this._getContext(result, match, 20)
          });
        }
        fixCount++;
      });

      result = result.replace(pattern, replacement);
    }
  });

  if (fixCount > 0) {
    changes.push({
      type: 'vietnamese_char_fix',
      count: fixCount,
      details: detailedChanges,
      remaining: Math.max(0, fixCount - MAX_DETAILS)
    });
  }

  return { text: result, changes };
}
```

### Step 3: Modify `_fixCoreVocabulary()`

**File:** `cleaner.service.js`
**Lines:** 620-637

**Apply same pattern:**
```javascript
_fixCoreVocabulary(text) {
  let result = text;
  const changes = [];
  let fixCount = 0;
  const detailedChanges = [];
  const MAX_DETAILS = 100;

  this.coreVocabulary.forEach(({ pattern, replacement }) => {
    const matches = result.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (detailedChanges.length < MAX_DETAILS) {
          detailedChanges.push({
            type: 'core_vocabulary',
            before: match,
            after: replacement,
            context: this._getContext(result, match, 20)
          });
        }
        fixCount++;
      });

      result = result.replace(pattern, replacement);
    }
  });

  if (fixCount > 0) {
    changes.push({
      type: 'core_vocabulary_fix',
      count: fixCount,
      details: detailedChanges,
      remaining: Math.max(0, fixCount - MAX_DETAILS)
    });
  }

  return { text: result, changes };
}
```

### Step 4: Modify `_applyLegalVocabulary()`

**File:** `cleaner.service.js`
**Lines:** 640-666

**Similar changes:**
```javascript
_applyLegalVocabulary(text) {
  let result = text;
  const changes = [];
  let totalFixes = 0;
  const allDetailedChanges = [];
  const MAX_DETAILS = 100;

  for (const [category, patterns] of Object.entries(this.legalVocabulary)) {
    let categoryFixes = 0;
    const categoryDetails = [];

    patterns.forEach(({ pattern, replacement }) => {
      const matches = result.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (allDetailedChanges.length < MAX_DETAILS) {
            categoryDetails.push({
              type: 'legal_vocabulary',
              category: category,
              before: match,
              after: replacement,
              context: this._getContext(result, match, 20)
            });
          }
          categoryFixes++;
        });

        result = result.replace(pattern, replacement);
      }
    });

    if (categoryFixes > 0) {
      allDetailedChanges.push(...categoryDetails);
      totalFixes += categoryFixes;
    }
  }

  if (totalFixes > 0) {
    changes.push({
      type: 'legal_vocabulary',
      count: totalFixes,
      details: allDetailedChanges,
      remaining: Math.max(0, totalFixes - MAX_DETAILS)
    });
  }

  return { text: result, changes };
}
```

### Step 5: Calculate Accurate Total Corrections

**File:** `cleaner.service.js`
**Lines:** 504-513 (in `clean()` method)

**After:**
```javascript
const metadata = this._createMetadata(
  originalLength,
  cleaned.length,
  changes.length,  // Category count (backward compat)
  docType
);

// NEW: Calculate accurate total corrections
metadata.totalCorrections = changes.reduce((sum, change) => {
  return sum + (change.count || 0);
}, 0);

metadata.changes = changes;
metadata.confidence = this._calculateConfidence(text, cleaned, changes, docType);

return { cleaned, metadata };
```

### Step 6: Update Metadata Structure in Backend

**File:** `server.js`
**Lines:** 125-142

**Add totalCorrections to response:**
```javascript
res.json({
  original: result.original,
  cleaned: result.cleaned,
  metadata: {
    documentType: result.metadata.documentType,
    changesCount: result.metadata.changesCount,      // Categories
    totalCorrections: result.metadata.totalCorrections,  // NEW: Accurate count
    confidence: result.metadata.confidence,
    originalLength: result.metadata.originalLength,
    cleanedLength: result.metadata.cleanedLength,
    reduction: result.metadata.reduction,
    changes: result.metadata.changes || []           // Includes details
  },
  pages: result.pages,
  processingTime: result.processingTime,
  ocrTime: result.ocrTime,
  cleaningTime: result.cleaningTime,
  filename: originalname
});
```

## Testing Strategy

### Unit Tests

**Test tracking accuracy:**
```javascript
// Test: Vietnamese character fixes
const text = 'Dia chi: 123, Dien thoai: 456';
const result = cleaner.clean(text);

expect(result.metadata.totalCorrections).toBe(2);
expect(result.metadata.changes[0].details).toHaveLength(2);
expect(result.metadata.changes[0].details[0].before).toBe('Dia chi');
expect(result.metadata.changes[0].details[0].after).toBe('Địa chỉ');
```

**Test context extraction:**
```javascript
const context = cleaner._getContext('Hello World Test', 'World', 5);
expect(context).toBe('...lo World Te...');
```

**Test detail limit:**
```javascript
// Create text with 150 corrections
const manyErrors = 'Dia chi '.repeat(150);
const result = cleaner.clean(manyErrors);

expect(result.metadata.totalCorrections).toBe(150);
expect(result.metadata.changes[0].details).toHaveLength(100);  // Capped
expect(result.metadata.changes[0].remaining).toBe(50);
```

### Integration Tests

**Test end-to-end:**
1. Process sample PDF
2. Verify metadata.totalCorrections accurate
3. Check changes array has details
4. Validate context strings readable

## Success Criteria

### Accuracy
- ✅ `totalCorrections` matches sum of all individual fixes
- ✅ Details include before/after/context
- ✅ First 100 changes captured per category
- ✅ Remaining count accurate

### Performance
- ✅ Context extraction <1ms per change
- ✅ Total overhead <100ms for typical document
- ✅ No memory issues with large documents

### Data Quality
- ✅ Context strings provide meaningful preview
- ✅ Before/after values accurate
- ✅ No duplicate changes tracked

## Risk Assessment

**Risks:**

1. **Performance Degradation**
   - **Risk:** Tracking 100+ changes takes time
   - **Mitigation:** Limit to 100 per category, lazy evaluation
   - **Severity:** Low

2. **Memory Usage**
   - **Risk:** Detailed changes increase response size
   - **Mitigation:** 100-item limit, context truncation
   - **Severity:** Low

3. **Context Extraction Errors**
   - **Risk:** indexOf() fails, wrong context shown
   - **Mitigation:** Fallback to match text only
   - **Severity:** Very Low

**Overall Risk:** **Low** (Controlled limits, tested approach)

## Performance Benchmarks

**Expected Performance:**

| Document Size | Original Time | With Tracking | Overhead |
|---------------|---------------|---------------|----------|
| Small (5 pages) | 50ms | 55ms | +10% |
| Medium (20 pages) | 200ms | 220ms | +10% |
| Large (50 pages) | 500ms | 550ms | +10% |

**Acceptable:** <20% overhead

## Todo List

- [ ] Add `_getContext()` helper method
- [ ] Modify `_fixVietnameseCharacters()` with tracking
- [ ] Modify `_fixCoreVocabulary()` with tracking
- [ ] Modify `_applyLegalVocabulary()` with tracking
- [ ] Calculate `totalCorrections` in metadata
- [ ] Update `server.js` response structure
- [ ] Write unit tests for tracking
- [ ] Test with sample documents
- [ ] Validate performance benchmarks
- [ ] Commit Phase 2 changes

## Next Steps

**After Phase 2:**
- Move to Phase 3 (UI implementation)
- Display corrections in frontend
- User testing and feedback

## Unresolved Questions

1. **Should we track whitespace normalization details?**
   - Current plan: No (too verbose)
   - Alternative: Sample 10 whitespace changes

2. **Should context include line numbers?**
   - Current plan: Just text context
   - Alternative: Add `lineNumber: 45` field

3. **Limit per category or total?**
   - Current plan: 100 per category
   - Alternative: 100 total across all
