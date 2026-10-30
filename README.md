# Charcoal

Turn any image into detailed ASCII art in your browser. Nothing is uploaded, and no account is needed.

- Mono, 16 colors, green, amber or original colors
- Optional on-device background removal
- Export animated or still SVG, PNG and plain text
- The pipeline matches its Python reference cell for cell, given the same mask

## Run it

```sh
npm install
npm run dev
```

`npm run build` writes a static site to `out/`, and `npm run check` runs the tests.

Background removal needs the U-2-Net model, which is too large for this repository. Download
[`u2net.onnx`](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx) to
`public/models/u2net.onnx`. Everything else works without it.

Set `NEXT_PUBLIC_SITE_URL` to your domain before deploying.

## License

Apache License 2.0. See [LICENSE](LICENSE).

If you redistribute this code or build on it, you must keep the attribution in [NOTICE](NOTICE),
which credits this project. Third-party components are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
