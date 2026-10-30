# Charcoal design system

`tokens.json` holds the values. This file records why.

## Brief
A private, in-browser tool that turns one image into detailed ASCII art. The theme is the material itself: wood, fire, the mark on paper, and keeping the drawing.

## Rules
- One sheet of toned paper, four full-screen stations that slide on x: Specimen, Kiln, Easel, Portfolio.
- One burn front divides every screen. Left of it nothing has color, with no exceptions.
- The art area stays unthemed, so people see the real output.
- Legal pages are the exception: vertical scroll, selectable text, no seam.

## Type
Recursive for everything. Its MONO axis changes as the burn front passes. Art uses the `ui-monospace` stack to match exported SVG.

## Motion
anime.js. Things enter warm and settle. Each station bleeds its ink wash scene onto the sheet, then writes its words. Reduced motion shows the finished state.

## Color
Paper and char are the base. Sanguine is the accent, ochre and leaf support it, and ember belongs to the seam.
