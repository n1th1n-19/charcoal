# Charcoal

Turn any image into detailed ASCII art in your browser. Your images never leave your device, and no account is needed.

Try it at [charcoal.daystack.space](https://charcoal.daystack.space).

## Features

- Mono, 16 colors, green, amber or original colors
- Live controls for columns (up to 400), gamma, contrast, white floor, sharpen and CLAHE, plus a single burn dial
- Optional on-device background removal with U-2-Net
- 3D animation: depth from Depth Anything V2 Small, eight preset motions, seamless loops
- Undo and redo, with live progress while an image is processed
- Drag and drop, paste or file picker, with a size choice for very large images
- Export animated or still SVG, with an optional frame, PNG up to 4x, and plain text
- 3D exports: animated SVG, a terminal player script, an asciinema recording and text frames
- The image pipeline matches its Python reference on 99.99% of cells, given the same mask

## How it works

The app is a static Next.js export. There is no server: a Web Worker does the image processing, and it caches each stage, so a change reruns only what it affects.

It moves through four screens: Specimen (add an image and choose Drawing or 3D animation), Kiln (watch it process), then Easel (adjust a drawing) or Maquette (shape a 3D animation), and Fixative (download it).

To play a 3D export in a terminal, run `sh your-file-3d.sh`. It needs a terminal at least as wide as the animation, and Git Bash or WSL on Windows.

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
| `lib/scene3d.ts`, `lib/exports3d.ts` | 3D renderer and presets, and the 3D exports |
| `lib/models.ts` | Verified, cached model downloads |
| `lib/config.ts` | Shared constants and defaults |
| `hooks/` | App logic: engine, history, stations, canvases, story animation |
| `components/stations/` | The screens, including both route choices |
| `components/ui/` | Smaller shared interface parts |
| `designed.md`, `tokens.json` | Design rules and values |

`public/loader.webp` is a saved render, used by the loader and the Specimen screen. It does not update by itself if you change that art.

## Deploy

Use the Next.js framework preset on Vercel. `vercel.json` sets it, along with the security headers. On another host, deploy `out/` and add those headers yourself.

To deploy under your own domain, set `NEXT_PUBLIC_SITE_URL`.

## Privacy

Images are processed in the browser and are never uploaded. Turning on background removal or making a 3D animation downloads a model from Hugging Face, which sees the visitor's IP address like any website.

The hosted site uses Vercel Web Analytics and Speed Insights to count visits and measure speed, without cookies. Both only send data when deployed on Vercel with them enabled for the project. If you fork this, remove them from `app/layout.tsx` or update the privacy policy to match your setup.

## License

Apache License 2.0. See [LICENSE](LICENSE).

If you redistribute this code or build on it, you must keep the attribution in [NOTICE](NOTICE),
which credits this project. Third-party components are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
