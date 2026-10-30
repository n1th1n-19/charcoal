# Charcoal

Turn any image into detailed ASCII art in your browser. Nothing is uploaded, and no account is needed.

## A note before you dig in

I apologize to whoever finds this repo: I built this entire project with AI.

The idea, the decisions and the testing are mine, but most of the code was written with AI assistance. That means there may be rough edges, odd patterns, or things a careful developer would have done differently. If you're here to learn from the code, double-check anything before you copy it into your own work. If you spot something broken or questionable, issues and pull requests are very welcome. I'm still learning, and this project is part of that.

## Features

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

Background removal downloads the U-2-Net model from
[Hugging Face](https://huggingface.co/n1th1n-19/charcoal-u2net) the first time someone turns it on.

To deploy under your own domain, set `NEXT_PUBLIC_SITE_URL`.

## License

Apache License 2.0. See [LICENSE](LICENSE).

If you redistribute this code or build on it, you must keep the attribution in [NOTICE](NOTICE),
which credits this project. Third-party components are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
