# Analysis Report: Viewport Width Expansion

**Date:** 2025-11-18 15:55
**Analyst:** Planning Agent
**Task:** Expand application to use most of viewport width

## Executive Summary

**Current State:** Container limited to 800px max-width
**Proposed Change:** Expand to 95% of viewport (capped at 1600px)
**Effort:** Minimal (1-line CSS change)
**Risk:** Very Low
**Impact:** High (better UX for side-by-side text comparison)

## Problem Analysis

### Current Constraint
```css
.container {
    max-width: 800px;  /* Fixed narrow width */
}
```

### Impact on New Feature
- Recent commit `34a5638` added side-by-side OCR cleaning
- Dual-pane layout cramped at 800px total width
- Each textarea only ~370px after gaps/padding
- Underutilizes modern displays (1440px+)

### User Experience Issues
1. Small text panes on large screens
2. Excessive whitespace on sides
3. Difficult to compare long lines side-by-side
4. Scrolling required for short text

## Technical Analysis

### CSS Specificity
- Single selector: `.container` (line 17)
- No conflicting rules
- Clean cascade to children

### Responsive Behavior
- Mobile (<768px): Separate media query, unaffected
- Tablet (768-1024px): Will expand appropriately
- Desktop (>1024px): Maximum benefit

### Browser Support
- `min()` function: Supported all modern browsers (2020+)
- Fallback available for older browsers
- No polyfill required

## Recommended Solution

### Approach: Hybrid min() Function
```css
max-width: min(95%, 1600px);
```

**Rationale:**
- Responsive up to 1600px
- Prevents excessive width on ultra-wide
- Single line change
- No media query needed

### Benefits by Screen Size

| Screen Width | Current | Proposed | Gain |
|--------------|---------|----------|------|
| 1920px | 800px | 1600px | +800px (100%) |
| 1440px | 800px | 1368px | +568px (71%) |
| 1366px | 800px | 1298px | +498px (62%) |
| 1024px | 800px | 973px | +173px (22%) |
| 768px | 768px | 730px | -38px (mobile layout) |

### Textarea Impact (Dual-Pane)

**Current (800px container):**
- Container: 800px
- Padding: 40px × 2 = 80px
- Available: 720px
- Gap: 20px
- Each pane: (720-20)/2 = **350px**

**Proposed (1600px container on 1920px screen):**
- Container: 1600px
- Padding: 40px × 2 = 80px
- Available: 1520px
- Gap: 20px
- Each pane: (1520-20)/2 = **750px** (+114%)

## Implementation Details

### File Changes
- **Modify:** `public/styles.css` (line 18)
- **Test:** All breakpoints
- **Risk:** Very Low

### Testing Matrix
- ✅ Desktop: 1920px, 1440px, 1366px
- ✅ Tablet: 1024px, 768px
- ✅ Mobile: 375px, 414px
- ✅ Ultra-wide: 2560px (verify cap)

## Alternatives Considered

### 1. Percentage Only (95%)
**Pros:** Simple, fully responsive
**Cons:** No upper limit, excessive on ultra-wide
**Verdict:** ❌ Rejected - needs cap

### 2. Fixed Large (1400px)
**Pros:** Predictable, good for 1440px
**Cons:** Not responsive, arbitrary number
**Verdict:** ❌ Rejected - not flexible

### 3. Hybrid min(95%, 1600px)
**Pros:** Responsive + capped, best of both
**Cons:** Slightly more complex
**Verdict:** ✅ **Recommended**

## Risk Mitigation

### Identified Risks & Mitigations

1. **Browser Compatibility**
   - Risk: min() not supported
   - Mitigation: Fallback media query
   - Likelihood: Very Low

2. **Mobile Regression**
   - Risk: Affects mobile layout
   - Mitigation: Separate media query protected
   - Likelihood: Very Low

3. **Layout Shift**
   - Risk: CLS on page load
   - Mitigation: CSS loaded before render
   - Likelihood: Very Low

4. **Readability on Ultra-wide**
   - Risk: Lines too long
   - Mitigation: 1600px cap
   - Likelihood: Low

## Success Metrics

### Quantitative
- Container width increases by 50-100% on desktop
- Each textarea pane ≥500px on 1440px+ screens
- No horizontal scrolling on any tested size

### Qualitative
- Side-by-side comparison more comfortable
- Better utilization of screen space
- No mobile UX degradation

## Recommendations

1. **Implement proposed solution** (min(95%, 1600px))
2. **Test thoroughly** on various screen sizes
3. **Monitor user feedback** post-deployment
4. **Consider future enhancement:** User-adjustable width

## Conclusion

**Go/No-Go:** ✅ **GO**

Simple, low-risk CSS change with significant UX improvement for dual-pane text comparison. Recommended for immediate implementation.

**Estimated Time:** 5 minutes
**Testing Time:** 10 minutes
**Total Effort:** 15 minutes
