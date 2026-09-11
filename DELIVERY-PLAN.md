# Sending the wardrobe

The approved destination is the public repository [Talos91/belughina-wardrobe](https://github.com/Talos91/belughina-wardrobe). GitHub Pages will serve `dist` at:

`https://talos91.github.io/belughina-wardrobe/`

## Ready locally

- Main character: 53.7 MiB → 7.2 MiB, 1,051,716 → 295,181 triangles.
- All 19 models, 13 rooms, clothes, accessories, Salami, and the complete letter are included.
- The complete static release is about 62 MiB. Only selected clothes and rooms download; Salami loads when the tote is selected.
- Full-quality models and original background PNGs are preserved outside the publishing repository.
- GitHub Actions checks the release before publishing. All URLs are relative so the project subdirectory works.
- Link preview artwork and title are configured. Search indexing is discouraged with robots metadata.
- Automated motion, garment attachment, 20 wrap-layer combinations, Salami, and letter persistence checks pass.
- Browser checks cover the lighter renderer, centered mobile letter, and a 1200×1200 photo export. Previous layout checks also cover Pixel portrait and phone landscape.

## Remaining before sending

1. Complete GitHub CLI sign-in, push `main`, enable GitHub Pages with GitHub Actions, and verify the deployed HTTPS URL.
2. Test a cold load on an actual iPhone, Pixel, and laptop. The desktop viewport checks do not test Safari or the phones' GPUs. Try opening through LINE/WhatsApp as well; use Safari or Chrome if the embedded browser has trouble.
3. Check saved looks and the letter again after a reload. Saves are per browser and device, so a LINE browser, Safari, and Chrome can each have separate progress.

Draft message to send only after the deployed link works:

> Made you a tiny monthversary surprise ♡ Open this when you have a little moment. Try the bag… [link]

No message has been sent to anyone.
