# Charcoal design system

`tokens.json` holds the values. This file records why.

## Brief
A private, in-browser tool that turns one image into detailed ASCII art. The theme is the material itself: wood, fire, the mark on paper, and keeping the drawing.

## Rules
- One sheet of toned paper, four full-screen stations that slide on x: Specimen, Kiln, Easel or Maquette, Fixative. Specimen chooses the route, Drawing or 3D animation.
- One burn front divides every screen. Left of it nothing has color, with no exceptions.
- The art area stays unthemed, so people see the real output.
- Legal pages are the exception: vertical scroll, selectable text, no seam.
- The uploaded preview shows the image's real colors. Only the seam's mono split applies to it.
- Progress is real or tied to the kiln's heat, never invented.

## Type
Recursive for everything. Its MONO axis changes as the burn front passes. Art uses the `ui-monospace` stack to match exported SVG.

## Layout
Art comes first on small screens. Phones move Easel controls behind Adjust, and short phones trim secondary text. Wide screens use the full width on every station.

## Motion
anime.js. Things enter warm and settle. Each station bleeds its ink wash scene onto the sheet, then writes its words. Story scenes use ink wash: diluted tones, wet bleeds, splashes and empty paper. Reduced motion shows the finished state.

## Color
Paper and char are the base. Sanguine is the accent, ochre and leaf support it, and ember belongs to the seam.
