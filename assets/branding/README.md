# wPost branding

wPost follows the wShell family identity with a warm orange **P** inside a
rounded charcoal browser window. The orange window outline, three toolbar dots
and address bar identify the web/API workspace, while the large P keeps the
product recognizable at small sizes. This browser-window identity ships in v0.2.2.

The target palette matches `wook-shell`: accent `#DA702C`, background `#100F0F`,
and browser frame `#DA702C`. The generated PNG retains subtle raster color variation;
the SVG wordmark uses the exact accent value.

## Assets

| File | Purpose |
| --- | --- |
| `wpost-icon.png` | Generated master icon with transparent exterior corners |
| `wpost-logo.svg` | Self-contained horizontal lockup with embedded icon and orange wPost text |
| `../wpost.ico` | Windows icon with 16, 24, 32, 48, 64, 128 and 256px PNG frames |

The SVG uses JetBrains Mono when available, falling back to Cascadia Mono,
Consolas and monospace. No external image or font download is required.
Keep the icon proportions and clear space intact. Use the P tile alone for
small application icons and the horizontal logo where the product name helps.

Regenerate the ICO and synchronize the application PNG/ICO/SVG and logo from
the master PNG on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make-icon.ps1
```

## Creation record

### v0.2.2 browser-window icon

Edited with OpenAI's built-in `image_gen` tool on 2026-10-09, using the previous
`wpost-icon.png` as the edit target. The browser frame, toolbar dots and address
bar were added while preserving the orange P identity. Earlier icons remain
in Git history and the previous local release folders.

Final prompt:

```text
Use case: precise-object-edit. Asset type: production wPost application icon. Image 1 is the edit target. Retain the warm orange uppercase P identity but transform its charcoal rounded tile into a clear minimal web browser window silhouette. Square 1024x1024 transparent canvas. Center one nearly square rounded browser window occupying about 88% of canvas width and 84% height, with a thick warm orange #DA702C outline. Interior flat charcoal #100F0F. Across the top add a simple browser toolbar separated from the content by a thick orange horizontal rule: three small orange circles on the left and one short rounded orange-outlined empty address bar on the right. Below the toolbar center a single large bold rounded uppercase P in solid #DA702C; use the existing P silhouette and large counter, scaled to fit with generous breathing space. The browser frame itself is the icon, not a second nested panel. Make the browser frame and P immediately legible at 16, 24 and 32 px. Flat clean geometric graphic, crisp edges, no texture, gradient, shadow, glow or depth. No text except P, no extra glyphs, no mockup, no watermark. True transparent exterior, opaque charcoal inside.
```

### Original P icon

Created on 2026-10-09 using OpenAI's built-in `image_gen` tool, with
`C:/Project/wook-shell/assets/branding/wshell-icon.png` as the reference/edit
target. The source repository was not modified. A second edit repaired an
unwanted blotch in the generated tile. The horizontal SVG combines the final
icon with a native text wordmark; image generation of that lockup was rejected
by the tool, so no generated lockup is included.

### Initial prompt

```text
Use case: precise-object-edit. Asset type: production application icon for wPost, sibling brand of wShell. Image 1 is the edit target. Replace only the orange lowercase w with a single bold uppercase "P". Preserve the rounded charcoal square tile, subtle dark outline, safe padding and transparent exterior corners. Center the P optically. Use a rounded geometric P with a generous open counter readable at 16px and a rounded stem end, single solid warm orange #DA702C. Tile flat charcoal #100F0F, outline #282726. Flat crisp minimal branding, no gradients, textures, lighting, shadows or bevels. No other letters, badges, wordmark, mockup or watermark. 1024x1024 PNG with real alpha outside the tile. Save the result locally and report its path.
```

### Final refinement prompt

```text
Use case: precise-object-edit. Fix this wPost P icon only: remove the irregular black/transparent blotch to the lower right of the P and fill it with the same continuous charcoal #100F0F tile surface. The tile must be fully opaque and uninterrupted everywhere inside its rounded boundary, including the P counter. Preserve exactly the P silhouette, position, rounded tile and border. Set the P to uniform flat warm orange #DA702C and tile to uniform flat #100F0F with border #282726, no texture or gradients. True transparency ONLY outside the rounded square. No other changes.
```
