# Evidence Center Architectural Analysis and Implementation Plan

**Date:** January 27, 2026
**Status:** PENDING USER REVIEW
**Author:** Claude Code Analysis

---

## Executive Summary

**Verdict: The architecture is SOUND. The implementation is INCOMPLETE.**

The Evidence Center has all the right infrastructure in place:
- Database schema (Evidence, StoredFile) ✅
- File storage (Vercel Blob) ✅
- PDF capture (pdfjs-dist) ✅
- Required libraries (pdf-lib, konva, react-konva) ✅

**What's broken:** The "last mile" connections - UI displays mock/placeholder data instead of fetching and displaying actual captured images.

---

## 1. Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVIDENCE CENTER DATA FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

 CAPTURE (✅ Working)        STORAGE (✅ Working)       DISPLAY (❌ Broken)
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                  │     │                  │     │                  │
│  PDFViewer       │     │  /api/evidence/  │     │  Evidence Page   │
│  Component       │     │  upload          │     │                  │
│                  │     │                  │     │  - Library       │
│  ┌────────────┐  │     │  ┌────────────┐  │     │  - Annotator     │
│  │  pdfjs     │  │     │  │ Vercel     │  │     │  - Exhibits      │
│  │  renders   │──┼────►│  │ Blob or   │──┼──X──│  - Comparison    │
│  │  to canvas │  │     │  │ local FS  │  │     │                  │
│  └────────────┘  │     │  └────────────┘  │     │  Shows MOCKS     │
│                  │     │                  │     │  not real images │
│  captureCurrentPg│     │  Creates:        │     │                  │
│  → base64 PNG    │     │  - StoredFile    │     │                  │
│                  │     │  - Evidence      │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
    Image captured          Image stored           Image NOT displayed
    correctly               correctly              (placeholder shown)

                         PDF EXPORT (❌ Not Implemented)
                    ┌──────────────────────────────────┐
                    │                                  │
                    │  "Generate PDF" button exists    │
                    │  but onClick does NOTHING        │
                    │                                  │
                    │  pdf-lib CAN embed images        │
                    │  (see addSignatureToPDF fn)      │
                    │  but no exhibit function exists  │
                    │                                  │
                    └──────────────────────────────────┘
```

---

## 2. Root Cause Analysis

### Issue 1: `ef.map is not a function` Error

**Location:** `/src/app/(dashboard)/evidence/page.tsx`

**Cause:** API response returns `undefined` or non-array, but code calls `.map()` directly.

**Risk Points:**
- Line 633: `clients.map(...)` - if `/api/clients` fails
- Line 665: `reports.map(...)` - if reports API fails
- Line 758: `pendingEvidence.slice(0,6).map(...)` - if state undefined
- Line 967: `filteredEvidence.map(...)` - if filter produces undefined

**Fix:** Add defensive checks: `(data || []).map(...)`

---

### Issue 2: Annotator Shows Mock Table, Not Actual Screenshot

**Location:** `/src/app/(dashboard)/evidence/page.tsx` lines 1606-1684

**Current Code (Problematic):**
```tsx
{/* Placeholder for actual canvas/image */}
<div className="w-[800px] h-[600px] bg-slate-100 relative">
  {/* Mock credit report table */}
  <div className="absolute inset-0 p-4">
    <div className="bg-slate-800 text-white p-3">
      {evidence.accountItem?.creditorName || "ACCOUNT"}
    </div>
    <table>
      {/* HARDCODED MOCK DATA - NOT THE CAPTURED IMAGE */}
    </table>
  </div>
</div>
```

**What Should Happen:**
```tsx
{evidence.renderedFile?.id && (
  <img
    src={`/api/files/${evidence.renderedFile.id}/download`}
    alt="Captured Evidence"
  />
)}
```

**The captured image EXISTS in storage but is never fetched or displayed.**

---

### Issue 3: Exhibit Preview Shows Placeholder Icons

**Location:** `/src/app/(dashboard)/evidence/page.tsx` lines 2104-2122

**Current Code (Problematic):**
```tsx
<div className="h-64 bg-slate-100 rounded-lg flex items-center justify-center">
  <div className="text-4xl mb-2">
    {ex.evidence.evidenceType === "SCREENSHOT" ? "📷" : "📄"}
  </div>
</div>
```

**Fix:** Display actual image instead of emoji.

---

### Issue 4: PDF Export Not Implemented

**"Generate PDF" Button:** Line 1946-1949 - Has no `onClick` handler!

**pdf-lib Capability:** The `addSignatureToPDF()` function (lines 640-676) PROVES image embedding works:
```typescript
signatureImage = await pdfDoc.embedPng(Buffer.from(base64Data, "base64"));
```

**Missing:** No `generateExhibitPackagePDF()` function exists.

---

## 3. Technology Assessment

### Libraries Installed (All Correct)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `pdfjs-dist` | 4.0.379 | PDF rendering & capture | ✅ Working |
| `pdf-lib` | 1.17.1 | PDF generation | ⚠️ Partial (letters only) |
| `konva` | 9.3.18 | Canvas manipulation | ❌ Installed but UNUSED |
| `react-konva` | 18.2.10 | React Konva bindings | ❌ Installed but UNUSED |
| `@vercel/blob` | 0.27.1 | Cloud file storage | ✅ Working |

### What's Missing

1. **No image fetch/display in Annotator** - Easy fix
2. **No image display in Exhibit preview** - Easy fix
3. **No `generateExhibitPackagePDF()` function** - Medium effort
4. **Konva not wired up for annotation** - Medium effort

### External Libraries Needed

**NONE** - Everything required is already installed.

---

## 4. Options

### Option A: Incremental Fix (RECOMMENDED)

**Keep:** Capture, Storage, Database, APIs
**Fix:** UI display connections, PDF generation

**Effort:** 3-5 days
**Risk:** Low

### Option B: Rebuild Core Workflow

**Rebuild:** Annotator, Exhibit Builder
**Keep:** Everything else

**Effort:** 5-8 days
**Risk:** Medium (may break existing features)

### Option C: Replace with External Library

**Replace:** Annotator with `fabric.js` or similar
**Keep:** Everything else

**Effort:** 5-7 days
**Risk:** High (integration complexity)

---

## 5. Recommended Implementation Plan

### Phase 1: Fix Image Display (CRITICAL - Day 1-2)

**Goal:** Get captured images actually displaying

**Tasks:**

1. **Create `<EvidenceImage>` Component**
   ```tsx
   // src/components/evidence/evidence-image.tsx
   interface Props {
     fileId: string;
     alt: string;
     className?: string;
   }

   export function EvidenceImage({ fileId, alt, className }: Props) {
     const [src, setSrc] = useState<string | null>(null);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       fetch(`/api/files/${fileId}/download`)
         .then(res => res.blob())
         .then(blob => setSrc(URL.createObjectURL(blob)))
         .finally(() => setLoading(false));
     }, [fileId]);

     if (loading) return <Skeleton />;
     if (!src) return <PlaceholderIcon />;
     return <img src={src} alt={alt} className={className} />;
   }
   ```

2. **Update Annotator** - Replace mock table with `<EvidenceImage>`

3. **Update Exhibit Preview** - Replace emoji with `<EvidenceImage>`

4. **Add Defensive Checks** - Fix `.map()` errors

---

### Phase 2: Annotation with Konva (Day 3-4)

**Goal:** Enable real annotation on actual images

**Tasks:**

1. **Create `<AnnotatorCanvas>` Component**
   - Load image onto Konva `Image` layer
   - Add annotation tools (Rectangle, Circle, Text, Arrow)
   - Enable drag/resize on shapes

2. **Save/Load Annotations**
   - Store in `Evidence.annotations` JSON field
   - Restore on load

3. **Export with Annotations**
   - Flatten Konva stage to PNG
   - Include annotations baked into image

---

### Phase 3: PDF Generation (Day 4-5)

**Goal:** Generate exhibit packages with embedded images

**Tasks:**

1. **Add `generateExhibitPackagePDF()` to pdf-generate.ts**
   ```typescript
   export async function generateExhibitPackagePDF(exhibits: Exhibit[]): Promise<Uint8Array> {
     const pdfDoc = await PDFDocument.create();

     // Cover page with index
     const coverPage = pdfDoc.addPage();
     // ... draw index

     // Each exhibit gets a page with embedded image
     for (const exhibit of exhibits) {
       const page = pdfDoc.addPage();

       // Fetch image and embed
       const imageBytes = await fetchImageAsBase64(exhibit.imageUrl);
       const image = await pdfDoc.embedPng(imageBytes);
       page.drawImage(image, { x, y, width, height });

       // Add caption
       page.drawText(`Exhibit ${exhibit.label}`, { ... });
     }

     return pdfDoc.save();
   }
   ```

2. **Create API Route** `/api/evidence/exhibits/pdf`

3. **Wire Up Button** in ExhibitBuilder

---

## 6. File Changes Summary

| File | Action | Priority |
|------|--------|----------|
| `src/components/evidence/evidence-image.tsx` | CREATE | P1 |
| `src/app/(dashboard)/evidence/page.tsx` | MODIFY | P1 |
| `src/components/evidence/annotator-canvas.tsx` | CREATE | P2 |
| `src/lib/pdf-generate.ts` | MODIFY | P3 |
| `src/app/api/evidence/exhibits/pdf/route.ts` | CREATE | P3 |

---

## 7. Decision Required

**Question for User:**

Do you want to proceed with **Option A (Incremental Fix)**?

This approach:
- Keeps all working infrastructure
- Adds ~3 new files
- Modifies ~3 existing files
- No new dependencies
- Estimated 3-5 days

**If YES:** I'll implement Phase 1 first (image display fixes).

**If NO:** Please specify:
- Different approach preference?
- Want to bring in external reference/tools?
- Need more detail on any section?

---

## Appendix: Quick Wins Available Now

If you want immediate progress while reviewing this plan:

1. **Fix `.map()` errors** (5 minutes)
   - Add `(data || [])` defensive checks

2. **Display image URL in console** (5 minutes)
   - Verify images ARE accessible via `/api/files/[id]/download`

3. **Test PDF library image embed** (15 minutes)
   - Verify `embedPng` works with base64 data

---

*This document is for review. No code changes will be made until approved.*
