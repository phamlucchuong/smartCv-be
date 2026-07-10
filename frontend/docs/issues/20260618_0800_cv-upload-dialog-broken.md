# CV Upload Dialog Does Not Appear on Button Click

## Overview

On the `web-candidate` CV management page (`/cv`), clicking either "Upload your first CV" or "Upload new CV" button does nothing visually. The expected upload dialog never appears, and no dark overlay is shown. The browser console logs a Radix UI accessibility warning.

Two separate problems are present:

1. **Accessibility warning** — `DialogContent` at `_account.cv.tsx:217` has no `<DialogDescription>`, triggering a Radix UI warning on every mount.

2. **Dialog and overlay invisible** — The dialog IS mounting (confirmed: the Radix UI description warning fires inside a `useEffect` that only runs when `DialogContent` is in the DOM, meaning `open={true}` is being set). The visual failure is caused by a **Tailwind v4 monorepo content-scanning gap**: `packages/ui/src/` is not scanned by `@tailwindcss/vite`, so CSS classes defined only in `dialog.tsx` — including `bg-black/80` (overlay backdrop), `translate-x-[-50%] translate-y-[-50%]` (centering), and `data-[state=open]:animate-in data-[state=open]:fade-in-0` (fade animation) — are never generated in the compiled CSS. The dark overlay does not render, the dialog content is not centered, and the animation utilities are absent.

## Reproduction Steps

1. Sign in as a candidate (use a fresh account with no CVs for the empty-state path).
2. Navigate to `/cv`.
3. If testing the empty state: confirm the "No CVs uploaded yet" placeholder is shown.
4. Click "Upload your first CV" (empty state) or "Upload new CV" (header button when CVs exist).
5. Observe: no overlay appears, no dialog appears.
6. Open browser DevTools → Console: `Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}.`
7. Optional — confirm the scanning gap: `grep -c "bg-black" dist/assets/index-*.css` returns `0` after `pnpm build`.

## Expected Behavior

Clicking the upload button opens a centered modal dialog with a dark overlay, containing a drag-and-drop zone and "Choose PDF file" button.

## Current Behavior

- No dark overlay appears.
- No dialog appears (dialog may render but is invisible and off-center due to missing CSS).
- Browser console logs the Radix UI accessibility warning.

## Impact Scope

Backend:
- No changes needed.

Frontend:
- [x] web-candidate (`apps/web-candidate/src/routes/_account.cv.tsx`)
- [x] packages/ui Tailwind config (`apps/web-candidate/src/main.tsx` → `@smart-cv/ui/src/globals.css` needs `@source` for `packages/ui/src/**`)
- [ ] web-recruiter (may have the same issue if it uses `Dialog` or other `packages/ui` components with classes that aren't used in the app's own source files)
- [ ] web-admin (same risk)

## Root Cause Analysis

### Problem 1 — Missing `DialogDescription`

`_account.cv.tsx` lines 215–259 define the upload dialog with only `<DialogTitle>` but no `<DialogDescription>`:

```tsx
const uploadDialog = (
  <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Upload New CV</DialogTitle>
        {/* missing: <DialogDescription> */}
      </DialogHeader>
      ...
    </DialogContent>
  </Dialog>
)
```

`@radix-ui/react-dialog` v1.1.15 requires either a `data-radix-dialog-description` element inside `DialogContent` or `aria-describedby={undefined}` on `DialogContent` to opt out. Neither is present. The warning fires at every open.

### Problem 2 — Tailwind v4 Monorepo Scanning Gap

Tailwind v4 (via `@tailwindcss/vite`) builds the CSS by scanning source files for class names. In this monorepo, the scanner processes the app's own source files (`apps/web-candidate/src/**`) but **does not automatically scan workspace packages** like `packages/ui/src/`.

As a result, CSS utility classes used as string literals in `packages/ui/src/components/ui/dialog.tsx` are never seen by the scanner and are absent from the compiled CSS:

| Class | Effect when missing |
|-------|---------------------|
| `bg-black/80` (overlay) | No dark backdrop — dialog appears over unmasked content |
| `translate-x-[-50%] translate-y-[-50%]` | Dialog not centered — top-left corner placed at viewport center |
| `data-[state=open]:animate-in` / `data-[state=open]:fade-in-0` | No fade-in animation |
| `data-[state=closed]:zoom-out-95` / etc. | No close animation |

**Confirmed** by inspecting the built dist: `grep -c "bg-black" dist/assets/index-*.css` returns `0`. The `@keyframes enter` IS present (injected unconditionally by `tailwindcss-animate`'s `addBase` call, which is plugin-level and not gated on content scanning), but the `.animate-in` and `.fade-in-0` utility class rules are absent.

The result: the dialog portal renders to `document.body` with minimal/incorrect styling — no backdrop, content uncentered and visually indistinguishable from the page background. The user sees nothing.

## Fix Plan

### Fix 1 — Add `DialogDescription` (accessibility warning)

In `apps/web-candidate/src/routes/_account.cv.tsx`:

1. Add `DialogDescription` to the import:
   ```tsx
   import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@smart-cv/ui'
   ```

2. Add a screen-reader-only description inside `DialogContent`, after `</DialogHeader>`:
   ```tsx
   <DialogDescription className="sr-only">
     {lang === 'VI' ? 'Tải lên file PDF (tối đa 5MB)' : 'Upload a PDF file (max 5MB)'}
   </DialogDescription>
   ```

`DialogDescription` is already exported from `packages/ui/src/components/ui/dialog.tsx` — no change to the package needed.

### Fix 2 — Add `@source` directive to include packages/ui (primary fix for invisible dialog)

In `packages/ui/src/globals.css`, add an explicit `@source` directive so Tailwind v4 scans the UI package's source files:

```css
@import "tailwindcss";
@plugin "tailwindcss-animate";
@source "../../apps/web-candidate/src/**/*.{tsx,ts}";  /* keep existing auto-scan */
@source "../../apps/web-recruiter/src/**/*.{tsx,ts}";  /* web-recruiter too */
@source "../../apps/web-admin/src/**/*.{tsx,ts}";      /* web-admin too */
@source "./src/**/*.{tsx,ts}";                          /* ui package itself */
```

**Or**, if the `globals.css` is app-specific (imported from each app separately), add the source directive directly in each app's `globals.css`/`index.css`:

For `apps/web-candidate/src/index.css`, add:
```css
@source "../../packages/ui/src/**/*.{tsx,ts}";
```

**Verification:** After applying the fix, run `pnpm -F web-candidate build` and check:
```bash
grep -c "bg-black" apps/web-candidate/dist/assets/index-*.css
# Should return > 0 after the fix
```

### Fix 2 Alternative — Remove `packages/ui` animation class dependency

If adding `@source` is not desirable (e.g., it makes the CSS too large), remove the `data-[state=open]:animate-in data-[state=open]:fade-in-0` animation classes from `packages/ui/src/components/ui/dialog.tsx` and replace with a plain `opacity`/`transition` approach that doesn't rely on `tailwindcss-animate`:

```tsx
// DialogOverlay — before:
"fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"

// after:
"fixed inset-0 z-50 bg-black/80 transition-opacity data-[state=closed]:opacity-0 data-[state=open]:opacity-100"
```

```tsx
// DialogContent — before:
"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg"

// after:
"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 transition-all data-[state=closed]:opacity-0 data-[state=open]:opacity-100 data-[state=closed]:scale-95 data-[state=open]:scale-100 sm:rounded-lg"
```

**Note:** This alternative changes dialog animations for ALL apps using `packages/ui`. The `@source` approach (Fix 2 primary) is preferred as it fixes the root cause without changing the animation design.

## Related Code

| File | Lines | Description |
|------|-------|-------------|
| `apps/web-candidate/src/routes/_account.cv.tsx` | 3, 215–259, 288, 305 | Upload dialog definition, trigger buttons |
| `packages/ui/src/components/ui/dialog.tsx` | 18–37 (`DialogOverlay`), 38–64 (`DialogContent`) | Classes with `bg-black/80`, centering transforms, animation utilities |
| `packages/ui/src/globals.css` | 1–2 | `@import "tailwindcss"` + `@plugin "tailwindcss-animate"` — missing `@source` for ui package |
| `packages/ui/package.json` | — | `"tailwindcss-animate": "^1.0.7"` |
| `apps/web-candidate/src/main.tsx` | 6–7 | Import order: `globals.css` then `index.css` |

## Notes

- Fix 2 (adding `@source`) may affect ALL dialogs, dropdowns, popovers, and other Radix UI components from `packages/ui` that use classes only defined in the package source — their animations and styles may appear correctly for the first time after the fix. Test broadly after applying.
- `web-recruiter` and `web-admin` likely have the same scanning gap. Check `Dialog` usage in those apps after fixing `web-candidate`.
- The `tailwindcss-animate` plugin itself does NOT need upgrading; v1.0.7 loads correctly via Tailwind v4's `@plugin` API. The keyframe definitions work. Only the utility class scanning is broken.
