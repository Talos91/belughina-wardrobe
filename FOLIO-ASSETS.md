# Illustrated folio materials

The visual direction comes from the user's approved illustrated folio references. No v3 styling or texture kit was used. Typography, cards, stitched tabs, buttons, spine hardware and borders remain live HTML/CSS/SVG. Garment thumbnails and the character come from the existing app models.

| Asset | Size | Alpha | Use |
| --- | --- | --- | --- |
| `dist/assets/folio/paper.webp` | 900 × 900 | Opaque | Subtle paper grain, tiled at 450–650 CSS pixels; do not stretch text or controls into it. |
| `dist/assets/folio/botanical-paper.webp` | 900 × 900 | Opaque | Integrated embroidered paper corner, displayed at 49–104 CSS pixels and softly masked into the folio margins. Preserve its aspect ratio. |
| `dist/assets/folio/salami.png` | 180 × 280 | RGBA | Transparent render of the existing Salami companion for its contextual summon button. Preserve aspect ratio. |

The paper and botanical paper were created with the built-in image generation tool, then encoded as WebP. The attempted isolated botanical images had opaque checkerboards and were rejected. Production uses the integrated paper artwork deliberately; it is not described as a transparent cutout. Full-resolution selected artwork and exact prompts are archived locally in `outputs/folio-review/source-art` outside the publishing repository.

The same folio components support desktop and mobile. At 1600 × 1000 the folio is about 608px wide. On phones, the drawer keeps one scrolling surface for Tops and Bottoms, and resizing it updates both the real WebGL camera and the backdrop. All touch controls have at least a 44px target in portrait layouts. Short viewports scroll rather than shrinking garments indefinitely.

Actual app screenshots were compared against the desktop and mobile material references. The local `outputs/folio-review` packet contains the comparison images. The screenshots show the live renderer; no reference character or garment illustration was substituted.
