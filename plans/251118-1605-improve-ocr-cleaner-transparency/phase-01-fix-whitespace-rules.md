# Phase 1: Fix Whitespace Rules

## Context Links

- **Parent Plan:** `plan.md`
- **Dependencies:** None
- **Related Docs:** `cleaner.service.js`
- **Related Issue:** Aggressive whitespace removal causing squished text

## Overview

**Date:** 2025-11-18
**Description:** Reduce whitespace processing aggression to preserve document formatting
**Priority:** High (blocking Phase 2)
**Implementation Status:** 🔵 Not Started
**Review Status:** 🟡 Pending Review
**Estimated Time:** 1 hour

## Problem Analysis

### Current Aggressive Processing

**Location 1: `_normalizeWhitespace()` (lines 580-597)**
```javascript
let result = text
  .replace(/\t/g, ' ')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .replace(/[ \t]+/g, ' ')           // ← Collapses ALL multiple spaces
  .replace(/\n{4,}/g, '\n\n\n')      // ← Max 3 newlines
  .replace(/^ +/gm, '')              // ← REMOVES all leading spaces
  .replace(/ +$/gm, '');             // ← Removes trailing spaces
```

**Location 2: `_finalCleanup()` (lines 728-733)**
```javascript
return text
  .replace(/\s{2,}/g, ' ')           // ← AGAIN collapses spaces
  .replace(/\n{4,}/g, '\n\n\n')      // ← AGAIN limits newlines
  .replace(/^\s+|\s+$/gm, '')        // ← AGAIN trims lines
  .trim();
```

### Problems Identified

1. **Double Processing:** Same regex patterns applied twice
2. **Indentation Loss:** Leading spaces completely removed
3. **Cramped Paragraphs:** Max 3 newlines = 2 blank lines feels tight
4. **Table Formatting:** Alignment spaces collapsed

### Impact Examples

**Before Cleaning (Original OCR):**
```
HỢP ĐỒNG CHO THUÊ

ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG
    - Địa chỉ: 123 Nguyễn Huệ
    - Diện tích: 100m²


ĐIỀU 2: THỜI HẠN
```

**After Current Cleaning (Squished):**
```
HỢP ĐỒNG CHO THUÊ
ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG
- Địa chỉ: 123 Nguyễn Huệ
- Diện tích: 100m²

ĐIỀU 2: THỜI HẠN
```

**Desired Output (Preserved):**
```
HỢP ĐỒNG CHO THUÊ

ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG
  - Địa chỉ: 123 Nguyễn Huệ
  - Diện tích: 100m²


ĐIỀU 2: THỜI HẠN
```

## Solution Design

### Approach: Conservative Processing

**Principles:**
1. Preserve intent over aggressive cleanup
2. Keep paragraph spacing (3-4 blank lines OK)
3. Maintain 2-4 space indentation
4. Remove redundant processing

### New Whitespace Rules

**Processing Order:**
1. Normalize line endings (safe)
2. Convert tabs to spaces (safe)
3. Limit excessive spaces (3+ → 2 spaces)
4. Limit excessive newlines (5+ → 4 newlines)
5. Remove trailing spaces only (safe)
6. Final trim

## Implementation Steps

### Step 1: Modify `_normalizeWhitespace()` Method

**File:** `cleaner.service.js`
**Lines:** 580-597

**Before:**
```javascript
_normalizeWhitespace(text) {
  const changes = [];
  const before = text;

  let result = text
    .replace(/\t/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')           // Too aggressive
    .replace(/\n{4,}/g, '\n\n\n')      // Too restrictive
    .replace(/^ +/gm, '')              // Removes indentation
    .replace(/ +$/gm, '');

  if (before !== result) {
    changes.push({ type: 'whitespace_normalization' });
  }

  return { text: result.trim(), changes };
}
```

**After:**
```javascript
_normalizeWhitespace(text) {
  const changes = [];
  const before = text;

  let result = text
    // Step 1: Normalize line endings (keep)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

    // Step 2: Convert tabs to 2 spaces (keep)
    .replace(/\t/g, '  ')

    // Step 3: Limit excessive spaces (CHANGED: 3+ → 2 spaces)
    .replace(/[ ]{3,}/g, '  ')

    // Step 4: Limit excessive newlines (CHANGED: 5+ → 4 newlines)
    .replace(/\n{5,}/g, '\n\n\n\n')

    // Step 5: Remove trailing spaces only (keep)
    .replace(/ +$/gm, '');

    // NOTE: Removed .replace(/^ +/gm, '') to preserve indentation

  if (before !== result) {
    changes.push({ type: 'whitespace_normalization' });
  }

  return { text: result.trim(), changes };
}
```

**Rationale:**
- `[ ]{3,}` preserves 1-2 space indentation
- `\n{5,}` allows up to 4 newlines (3 blank lines)
- Removed leading space removal entirely
- Keep trailing space removal (always safe)

### Step 2: Simplify `_finalCleanup()` Method

**File:** `cleaner.service.js`
**Lines:** 728-733

**Before:**
```javascript
_finalCleanup(text) {
  return text
    .replace(/\s{2,}/g, ' ')           // Redundant
    .replace(/\n{4,}/g, '\n\n\n')      // Redundant
    .replace(/^\s+|\s+$/gm, '')        // Redundant
    .trim();
}
```

**After:**
```javascript
_finalCleanup(text) {
  // Only trim document edges, no internal processing
  return text.trim();
}
```

**Rationale:**
- Remove all redundant processing
- `_normalizeWhitespace()` already handles internal cleanup
- Just trim document start/end

### Step 3: Add Configuration Option (Optional)

**File:** `cleaner.service.js`
**Lines:** 12-19

**Add option:**
```javascript
constructor(options = {}) {
  this.options = {
    aggressiveCleaning: false,
    preserveCodes: true,
    fixStructure: true,
    detectDocumentType: true,
    preserveIndentation: true,      // ← NEW OPTION
    maxSpaces: 2,                    // ← NEW: Max consecutive spaces
    maxNewlines: 4,                  // ← NEW: Max consecutive newlines
    ...options
  };
  // ...
}
```

**Usage in method:**
```javascript
_normalizeWhitespace(text) {
  const maxSpaces = this.options.maxSpaces || 2;
  const maxNewlines = this.options.maxNewlines || 4;

  let result = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(new RegExp(`[ ]{${maxSpaces + 1},}`, 'g'), ' '.repeat(maxSpaces))
    .replace(new RegExp(`\\n{${maxNewlines + 1},}`, 'g'), '\n'.repeat(maxNewlines))
    .replace(/ +$/gm, '');

  // ...
}
```

**Benefit:** Future flexibility without code changes

### Step 4: Update JSDoc Comments

**Add documentation:**
```javascript
/**
 * Normalize whitespace while preserving document structure
 *
 * Rules:
 * - Converts tabs to 2 spaces
 * - Limits consecutive spaces to 2 (preserves indentation)
 * - Limits consecutive newlines to 4 (preserves paragraph spacing)
 * - Removes trailing spaces from lines
 * - Preserves leading spaces for indentation
 *
 * @param {string} text - Text to normalize
 * @returns {{text: string, changes: Array}} Normalized text and changes
 */
_normalizeWhitespace(text) {
  // ...
}
```

## Testing Strategy

### Unit Tests

**Test Cases:**
1. **Preserve Indentation**
   - Input: `"  Item 1\n    Subitem"`
   - Expected: Indentation preserved

2. **Limit Excessive Spaces**
   - Input: `"Word     Word"`
   - Expected: `"Word  Word"` (2 spaces)

3. **Preserve Paragraph Spacing**
   - Input: `"Para 1\n\n\n\nPara 2"`
   - Expected: 4 newlines preserved

4. **Remove Trailing Spaces**
   - Input: `"Line   \nNext"`
   - Expected: Trailing spaces removed

### Integration Tests

**Test Documents:**
1. Contract with indented clauses
2. Invoice with aligned columns
3. Report with section spacing

**Validation:**
- Visual comparison before/after
- Line-by-line diff analysis
- User readability test

## Success Criteria

### Visual Validation
- ✅ Paragraph spacing looks natural (not cramped)
- ✅ Indented lists maintain structure
- ✅ Tables remain aligned
- ✅ Section breaks clear and visible

### Technical Validation
- ✅ Max 2 consecutive spaces (except newlines)
- ✅ Max 4 consecutive newlines
- ✅ Leading spaces 0-4 characters preserved
- ✅ No double processing

### User Experience
- ✅ Cleaned text easier to read than current
- ✅ Structure matches original intent
- ✅ No layout "squishing" perception

## Risk Assessment

### Identified Risks

1. **Edge Cases with Large Indents**
   - **Risk:** Documents with 5+ space indentation
   - **Mitigation:** Configurable `maxSpaces` option
   - **Severity:** Low

2. **Backward Compatibility**
   - **Risk:** Existing users expect current behavior
   - **Mitigation:** A/B test, add toggle option
   - **Severity:** Low

3. **Performance Impact**
   - **Risk:** Multiple regex passes
   - **Mitigation:** Already doing this, just changing patterns
   - **Severity:** Very Low

4. **OCR Artifacts**
   - **Risk:** Preserve unwanted OCR spacing errors
   - **Mitigation:** Still limit to 2 spaces, 4 newlines
   - **Severity:** Low

**Overall Risk:** **Low** (Improves quality, minimal code change)

## Performance Considerations

**Impact:** Negligible
- Same number of regex operations
- Slightly less aggressive = slightly faster
- No new loops or iterations

**Before:** ~5-10ms for typical document
**After:** ~5-10ms (no measurable change)

## Rollback Plan

**If issues arise:**
1. Revert `_normalizeWhitespace()` changes
2. Restore `_finalCleanup()` logic
3. Git revert commit

**Testing before release:**
- Test with 10+ diverse documents
- Compare side-by-side with current version
- User acceptance test

## Next Steps

### After Implementation
1. Deploy to staging
2. User testing with real documents
3. Gather feedback on spacing
4. Adjust `maxSpaces`/`maxNewlines` if needed
5. Deploy to production

### Future Enhancements (Out of Scope)
- User-adjustable whitespace preferences
- Document type-specific whitespace rules
- Visual whitespace indicator (·⏎ symbols)

## Todo List

- [ ] Back up current `cleaner.service.js`
- [ ] Modify `_normalizeWhitespace()` method
- [ ] Simplify `_finalCleanup()` method
- [ ] Add configuration options (optional)
- [ ] Update JSDoc comments
- [ ] Create test cases
- [ ] Test with contract document
- [ ] Test with invoice document
- [ ] Test with report document
- [ ] Visual comparison review
- [ ] Commit changes with descriptive message
- [ ] Tag as Phase 1 complete

## Unresolved Questions

1. **Should we preserve ALL leading spaces or cap at 4?**
   - Current plan: Preserve up to 2-3 spaces naturally
   - Alternative: Explicitly cap at 4 spaces max

2. **Should tabs convert to 2 or 4 spaces?**
   - Current plan: 2 spaces (compact)
   - Alternative: 4 spaces (traditional)

3. **Add user toggle for "Preserve Formatting"?**
   - Current plan: Apply to all
   - Alternative: Make optional checkbox
