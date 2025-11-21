# Improve OCR Cleaner Transparency & Whitespace Handling

**Created:** 2025-11-18 16:05
**Status:** 🟡 Pending Review
**Priority:** Medium
**Complexity:** Medium (3-4 hours)

## Overview

Fix aggressive whitespace removal in OCR cleaner and add detailed correction tracking with UI display. Current implementation "squishes" text by removing newlines/spacing too aggressively and undercounts actual corrections made.

## Problem Statement

### Current Issues
1. **Aggressive Whitespace Removal:** Text appears squished, paragraph breaks lost
2. **Inaccurate Correction Count:** Reports 7 changes when 47+ corrections made
3. **No Transparency:** Users can't see what was corrected
4. **Double Processing:** `_normalizeWhitespace()` + `_finalCleanup()` redundantly collapse spaces

### User Impact
- Cleaned text harder to read than original
- Mistrust in cleaning quality
- No way to verify corrections
- Can't audit or improve cleaning rules

## Solution: Conservative Whitespace + Detailed Change Log

### Approach
1. Reduce whitespace aggression (preserve formatting)
2. Track individual corrections with before/after
3. Display scrollable change log at bottom
4. Show accurate total correction count

## Implementation Phases

### Phase 1: Fix Whitespace Rules
**File:** `phase-01-fix-whitespace-rules.md`
**Status:** 🔵 Ready
**Time:** 1 hour
**Changes:**
- Modify `_normalizeWhitespace()` to preserve indentation
- Remove redundant `_finalCleanup()` processing
- Allow more paragraph spacing (up to 4 newlines)
- Preserve 2-space indentation

### Phase 2: Add Detailed Change Tracking
**File:** `phase-02-detailed-change-tracking.md`
**Status:** 🔵 Ready
**Time:** 1.5 hours
**Changes:**
- Add `detailedChanges` array to each cleaning method
- Track before/after for each replacement
- Capture context (surrounding text)
- Limit to 100 changes for performance
- Calculate accurate total count

### Phase 3: Build Change Log UI
**File:** `phase-03-change-log-ui.md`
**Status:** 🔵 Ready
**Time:** 1 hour
**Changes:**
- Add corrections log section below metadata
- Display before → after for each correction
- Show total corrections count
- Collapsible/scrollable design
- Category grouping (char fixes, vocab, etc)

## Success Criteria

### Functional
- ✅ Cleaned text preserves paragraph spacing
- ✅ Indentation maintained (tables, lists)
- ✅ Total corrections count accurate
- ✅ Change log displays all corrections
- ✅ UI shows before → after examples

### Non-Functional
- ✅ Performance: <100ms overhead for tracking
- ✅ UI responsive with 100+ corrections
- ✅ No breaking changes to existing API
- ✅ Backward compatible metadata structure

## Risk Assessment

**Risk Level:** Low-Medium
- Whitespace changes may affect edge cases
- Large change logs could impact performance
- Need thorough testing with various document types

## Files Affected

### Backend
- `cleaner.service.js` (whitespace methods, change tracking)
- `ocr-processor.js` (no changes, just returns new metadata)

### Frontend
- `public/index.html` (add corrections log section)
- `public/app.js` (render change log)
- `public/styles.css` (style corrections display)

## Testing Strategy

**Test Documents:**
1. Contract with proper paragraphs
2. Invoice with table alignment
3. Document with indented lists
4. Multi-page with 100+ corrections

**Validation:**
- Compare reported vs actual corrections
- Visual inspection of spacing preservation
- Performance test with large documents

## Dependencies

- No external dependencies
- Builds on existing cleaner architecture
- Compatible with current metadata structure

## Related Issues

- Original implementation: Commit `34a5638`
- User feedback: "cleaned version seems very squished"
- Reported: 7 changes vs Actual: 47+ corrections

## Next Steps

1. Review plan with user
2. Approve approach and priority
3. Implement phases sequentially
4. Test thoroughly
5. Deploy and gather feedback
