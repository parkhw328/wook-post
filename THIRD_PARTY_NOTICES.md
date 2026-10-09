# Third-Party Notices

wPost's own code and project-owned assets are offered under the root [MIT License](LICENSE), to the extent rights are held. Third-party components remain under their original licenses; the root license does not relicense fonts, libraries, or Electron/Chromium components.

## Bundled software

Full, unmodified upstream license texts are preserved in [`licenses/Software-LICENSES.txt`](licenses/Software-LICENSES.txt), generated from the installed versions by `npm run licenses:sync` during every build.

| Component         | Version | License                                                         |
| ----------------- | ------- | --------------------------------------------------------------- |
| React / React DOM | 19.3.0  | MIT                                                             |
| Scheduler         | 0.28.0  | MIT                                                             |
| Lucide React      | 1.52.0  | ISC; Feather-derived icons retain their MIT notice              |
| Zod               | 4.6.5   | MIT                                                             |
| Electron          | 44.7.0  | MIT for Electron itself; component-specific licenses also apply |

React, React DOM, Scheduler, Lucide and Zod are bundled into the renderer; Zod is also shipped as a main-process dependency. Electron's original `LICENSE.electron.txt` and `LICENSES.chromium.html` remain beside the executable. The latter contains the complete upstream component notices, including FFmpeg; these components are not all MIT-licensed. Electron source and its pinned dependency definitions are available at [electron/electron v44.7.0](https://github.com/electron/electron/tree/v44.7.0). Do not remove these files when redistributing the installer or unpacked app.

## Fonts and design references

wPost uses the following design assets from the sibling wShell project and Google Fonts. Copies of their license texts are included in `licenses/`, shipped with the application, and available in **앱 정보 → 라이선스 및 오픈소스 고지**.

| Asset                                            | Origin                                                                                                                                                                                                                          | License                                                                         | Local copy                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| wShell branding reference (theme/font selection) | wShell, commit `970b131099ca3905607cc19ec60106af529adb4c`                                                                                                                                                                       | MIT, copyright 2026 Wook Shell contributors                                     | `licenses/wShell-MIT.txt`        |
| Flexoki Dark color palette                       | Steph Ango, [Flexoki](https://github.com/kepano/flexoki), revision `8d723bac4a9ac46adfdf99d42155286977aac72a` as recorded by wShell                                                                                             | MIT, copyright 2023 Steph Ango                                                  | `licenses/Flexoki-MIT.txt`       |
| JetBrains Mono Regular and Bold, v2.304          | [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), bundled by wShell                                                                                                                                                 | SIL Open Font License 1.1, copyright 2020 The JetBrains Mono Project Authors    | `licenses/JetBrainsMono-OFL.txt` |
| Noto Sans KR Variable, v2.004                    | [Google Fonts](https://github.com/google/fonts/tree/b38c5c93af322c45f633e17ac440ec1e6c94d489/ofl/notosanskr), revision `b38c5c93af322c45f633e17ac440ec1e6c94d489`; upstream Noto CJK `523d033d6cb47f4a80c58a35753646f5c3608a78` | SIL Open Font License 1.1, copyright 2014–2021 Adobe, Reserved Font Name Source | `licenses/NotoSansKR-OFL.txt`    |

The bundled fonts are copied without modification. The current application icon is an orange P inside a charcoal browser window, developed from the sibling wShell icon reference. The source and generation record are in `assets/branding/`; `build/icon.svg` embeds the PNG master and `scripts/build-icons.mjs` generates the application PNG and ICO files. The previous wShell orange w icon is no longer shipped. The wShell MIT notice remains included for the design reference. The Flexoki palette is adapted into application color tokens. The original font names are retained; the fonts are bundled as part of the application and are not sold separately.

These notices cover the shared design assets. Software dependencies retain their own license notices, including Electron's bundled license files.

Noto Sans KR is copied byte-for-byte from `NotoSansKR[wght].ttf`; only the local filename is `NotoSansKR-Variable.ttf`. SHA-256: `194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252`. It is used as the Korean fallback after JetBrains Mono, with no external font requests.
