# Phase 1: Update Container Width

## Context Links

- **Parent Plan:** `plan.md`
- **Dependencies:** None
- **Related Docs:** `docs/code-standards.md`, `docs/codebase-summary.md`
- **Related Commit:** `34a5638` (side-by-side OCR cleaning)

## Overview

**Date:** 2025-11-18
**Description:** Expand container width from 800px to utilize most of viewport
**Priority:** Low
**Implementation Status:** 🔵 Not Started
**Review Status:** 🟡 Pending Review

## Key Insights

### Current State Analysis

**Container CSS (styles.css:17-24):**
```css
.container {
    max-width: 800px;  /* ← CONSTRAINT */
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}
```

**Impact:**
- Dual-text comparison limited to 800px total width
- Each textarea pane ~370px after gap/padding
- Underutilizes large displays (1920px, 1440px)
- Recently added side-by-side feature cramped

### Optimal Solution

**Option A: Percentage-based (Recommended)**
```css
max-width: 95%;  /* Responsive, adapts to any screen */
```
- ✅ Scales with viewport
- ✅ Maintains margins on all sizes
- ✅ Most flexible

**Option B: Large Fixed Width**
```css
max-width: 1400px;  /* Fixed maximum */
```
- ✅ Predictable layout
- ✅ Prevents excessive width on ultra-wide
- ⚠️ Less flexible than percentage

**Option C: Hybrid Approach (Best)**
```css
max-width: min(95%, 1600px);  /* Best of both */
```
- ✅ Responsive up to 1600px
- ✅ Caps at reasonable maximum
- ✅ Prevents line-length readability issues

## Requirements

### Functional Requirements
1. Container uses ~90-95% of viewport width
2. Dual-text panes display comfortably side-by-side
3. Mobile behavior unchanged (<768px)
4. No horizontal scrolling introduced

### Non-Functional Requirements
1. No layout shift/flicker on load
2. Maintain current responsive breakpoints
3. Preserve visual hierarchy
4. Keep existing animations/transitions

## Architecture

### CSS Cascade Impact

**Single Change Location:**
```
public/styles.css:18
  ↓
.container { max-width: ... }
  ↓
Affects all child elements:
  - header
  - main
  - footer
  - dual-text-container (inherits width)
```

**No conflicts with:**
- `.dual-text-container` (grid layout adapts)
- `.text-pane` (percentage-based)
- Mobile styles (separate media query)

## Related Code Files

### Files to Modify
1. **`public/styles.css`** (Line 18)
   - Change: `.container { max-width: 800px; }`
   - To: `.container { max-width: min(95%, 1600px); }`

### Files to Review (No Changes)
- `public/index.html` - Structure remains same
- `public/app.js` - No JavaScript changes needed

## Implementation Steps

### Step 1: Update Container CSS
**File:** `public/styles.css`
**Line:** 18

**Before:**
```css
.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}
```

**After:**
```css
.container {
    max-width: min(95%, 1600px);  /* Responsive with maximum cap */
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}
```

**Alternative (if min() not supported in target browsers):**
```css
.container {
    max-width: 95%;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* Add separate constraint for ultra-wide */
@media (min-width: 1680px) {
    .container {
        max-width: 1600px;
    }
}
```

### Step 2: Verify Mobile Breakpoint
**File:** `public/styles.css`
**Lines:** 270-297

**Ensure unchanged:**
```css
@media (max-width: 768px) {
    .container {
        padding: 15px;  /* ← No max-width override needed */
    }
    /* ... rest unchanged */
}
```

### Step 3: Test Responsive Behavior

**Desktop Testing:**
- 1920x1080: Container ~1600px (capped)
- 1440x900: Container ~1368px (95%)
- 1366x768: Container ~1298px (95%)

**Tablet Testing:**
- 1024x768: Container ~973px (95%)
- 768x1024: Switch to mobile layout

**Mobile Testing:**
- <768px: Existing mobile styles apply

## Todo List

- [ ] Read current styles.css
- [ ] Update `.container` max-width to `min(95%, 1600px)`
- [ ] Test on desktop (1920px, 1440px, 1366px)
- [ ] Test on tablet (1024px, 768px)
- [ ] Test on mobile (<768px)
- [ ] Verify dual-text panes expand properly
- [ ] Check no horizontal scroll on any size
- [ ] Verify header/footer alignment
- [ ] Take before/after screenshots
- [ ] Commit changes with descriptive message

## Success Criteria

### Visual Validation
- ✅ Dual-text comparison uses available width
- ✅ Each textarea pane ≥500px on 1440px+ screens
- ✅ Margins visible on all screen sizes
- ✅ No layout breaks or misalignment
- ✅ Mobile layout identical to before

### Technical Validation
- ✅ No horizontal scrollbar appears
- ✅ Container max-width applies correctly
- ✅ Responsive breakpoints still function
- ✅ No CSS warnings/errors in console

### User Experience
- ✅ Text comparison easier to read
- ✅ Better space utilization on large screens
- ✅ Mobile experience unchanged

## Risk Assessment

**Likelihood × Impact = Risk Level**

### Identified Risks

1. **Ultra-wide Displays (>2560px)**
   - **Risk:** Text lines too long, readability suffers
   - **Mitigation:** 1600px cap prevents excessive width
   - **Severity:** Low

2. **Browser Compatibility (min() function)**
   - **Risk:** Older browsers may not support CSS min()
   - **Mitigation:** Fallback with media query
   - **Severity:** Very Low (min() supported since 2020)

3. **Layout Shift on Load**
   - **Risk:** Container width change causes CLS
   - **Mitigation:** CSS loaded before render
   - **Severity:** Very Low

4. **Mobile Regression**
   - **Risk:** Change affects mobile layout
   - **Mitigation:** Mobile uses separate media query
   - **Severity:** Very Low

**Overall Risk:** **Very Low** (CSS-only, easily reversible)

## Security Considerations

**None** - Pure presentational CSS change, no security implications.

## Performance Considerations

**Impact:** Negligible
- CSS parsing: No measurable change
- Rendering: Slightly larger paint area (minimal)
- Layout calculations: Same complexity

## Accessibility Considerations

**Positive Impact:**
- Larger textareas easier to read
- More comfortable line length for dyslexia
- Better use of assistive tech screen space

**Neutral:**
- No color contrast changes
- No focus indicator changes
- No keyboard navigation impact

## Next Steps

### After Implementation
1. Monitor user feedback on new width
2. Consider adding user preference toggle (future)
3. Update documentation/screenshots if needed

### Future Enhancements (Out of Scope)
- User-adjustable container width slider
- Remember user width preference in localStorage
- Resizable dual-pane splitter

## Unresolved Questions

None - straightforward CSS change with clear requirements.
