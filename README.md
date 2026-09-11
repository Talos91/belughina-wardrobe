# Belughina's little wardrobe

A small monthversary gift: dress up a beluga, try different poses, choose a room, and discover a surprise in her tote.

The wardrobe has direct Dresses, Tops, Bottoms, Extras, and Room tabs, labeled item cards, a color sheet, and visible sunglasses placement controls. The mobile picker expands to show every item.

A static Three.js app with 17 wardrobe pieces, six backgrounds, four varied outfit reactions, saved looks, photo export, and Salami's keepsake letter. The letter unlocks after the first Salami landing and stays available from the envelope in that browser.

## Run locally

Use Node.js 22 or later for checks:

```sh
npm test
```

The tests use the vendored Three.js and Meshopt decoder; they do not require an install. To preview, serve `dist` with a static HTTP server, for example:

```sh
python -m http.server 5173 --directory dist
```

## Publish

The GitHub Actions workflow checks the app and publishes only `dist` to GitHub Pages on each push to `main`. GitHub Pages is enabled and uses GitHub Actions.

Play: [Belughina’s little wardrobe](https://talos91.github.io/belughina-wardrobe/).

See [DELIVERY-PLAN.md](DELIVERY-PLAN.md) for deployment status and final device checks. No accounts, backend, or app installation are needed to play. Progress uses local browser storage and does not sync between devices.

## Web assets

The character is 7.2 MiB, reduced from 53.7 MiB. Its face expression vertices are preserved; body and hair geometry use conservative simplification. Wearable topology, UV layout, layer morphs, and skin weights are retained. The three tops use a consistent fitted torso; switching to the black halter preserves the shirt’s bottom layers. Relaxed crosses the fins with continuous skin weighting at their roots. Position rounding is bounded to 0.00000191 model units. All nine source animation clips retain their original samples.

Meshes use EXT_meshopt_compression and textures/backgrounds use WebP. Clothes and rooms load when selected; Salami starts loading when the tote is selected. The renderer limits touch-device pixel density and releases unused outfits from its cache.

Full-quality Blender sources and the original GLBs/PNGs remain outside this repository. To regenerate web assets from an original asset directory containing `models/*.glb` and `backgrounds/*.png`:

```sh
npm ci
npm run optimize-assets -- /path/to/full-quality-static
npm test
```

Use original exports as input. Do not repeatedly optimize the web assets. The detailed before/after sizes are in [ASSET-REPORT.json](ASSET-REPORT.json).

## Validation

Automated checks exercise interrupted animations, held poses, four outfit reactions, rapid nose taps, garment attachment, all 20 wrap combinations, Salami replay/removal, and browser-storage fallbacks for the letter. Visual checks cover top fits, clean dress surfaces, layered outfits, accessory positions, phone portrait and landscape layouts, the mobile letter, and photo export. Physical iPhone/Pixel hardware has not been tested.

Three.js and Meshoptimizer retain their vendor license files in `dist/vendor`.
