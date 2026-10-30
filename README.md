# Charcoal

Turn any image into detailed ASCII art in your browser. Your images never leave your device, and no account is needed.

Try it at [charcoal.daystack.space](https://charcoal.daystack.space).

## A note before you dig in

I apologize to whoever finds this repo: I built this entire project with AI.

The idea, the decisions and the testing are mine, but most of the code was written with AI assistance. That means there may be rough edges, odd patterns, or things a careful developer would have done differently. If you're here to learn from the code, double-check anything before you copy it into your own work. If you spot something broken or questionable, issues and pull requests are very welcome. I'm still learning, and this project is part of that.

## Features

- Mono, 16 colors, green, amber or original colors
- Live controls for columns (up to 400), gamma, contrast, white floor, sharpen and CLAHE, plus a single burn dial
- Optional on-device background removal with U-2-Net
- Undo and redo, with live progress while an image is processed
- Drag and drop, paste or file picker, with a size choice for very large images
- Export animated or still SVG, with an optional frame, PNG up to 4x, and plain text
- The image pipeline matches its Python reference on 99.99% of cells, given the same mask

## How it works

The app is a static Next.js export. There is no server: a Web Worker does the image processing, and it caches each stage, so a change reruns only what it affects.

It moves through four screens: Specimen (add an image), Kiln (watch it process), Easel (adjust the drawing) and Fixative (download it).

## Run it

```sh
npm install
npm run dev
```

`npm run build` writes a static site to `out/`, and `npm run check` runs the tests. Serve `out/` over HTTP, as module workers do not run from `file://`.

Background removal downloads the U-2-Net model from
[Hugging Face](https://huggingface.co/n1th1n-19/charcoal-u2net) the first time someone turns it on.

## Project layout

| Path | Holds |
|---|---|
| `lib/pipeline.ts` | The image pipeline, with no DOM, so tests can run it in Node |
| `lib/worker.ts` | Stage cache and background model |
| `lib/render.ts`, `lib/exports.ts` | Rasterizing, and SVG and text output |
| `lib/config.ts` | Shared constants and defaults |
| `hooks/` | App logic: engine, history, stations, canvases, story animation |
| `components/stations/` | The four screens |
| `components/ui/` | Smaller shared interface parts |
| `designed.md`, `tokens.json` | Design rules and values |

`public/loader.webp` is a saved render, used by the loader and the Specimen screen. It does not update by itself if you change that art.

## Deploy

Use the Next.js framework preset on Vercel. `vercel.json` sets it, along with the security headers. On another host, deploy `out/` and add those headers yourself.

To deploy under your own domain, set `NEXT_PUBLIC_SITE_URL`.

## Privacy

Images are processed in the browser and are never uploaded. Turning on background removal downloads the model from Hugging Face, which sees the visitor's IP address like any website.

The hosted site uses Vercel Web Analytics and Speed Insights to count visits and measure speed, without cookies. Both only send data when deployed on Vercel with them enabled for the project. If you fork this, remove them from `app/layout.tsx` or update the privacy policy to match your setup.

## License

Apache License 2.0. See [LICENSE](LICENSE).

If you redistribute this code or build on it, you must keep the attribution in [NOTICE](NOTICE),
which credits this project. Third-party components are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
