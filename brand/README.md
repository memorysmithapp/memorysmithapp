# MemorySmith.app brand

The brand of MemorySmith.app as the brand book *Livro da marca v1* (Figma) draws it: the symbol, the lockups, the colours, the type, the voice, and the rules for using them. The interface carries the colours and the type in the tokens of [`memorysmithapp-frontend/src/styles.css`](../memorysmithapp-frontend/src/styles.css).

The symbol is a graph that forms a brain: memory built node by node, where each circle is a note and each stem is a link between notes. Everything drawn with this brand reads for people and for AI agents alike.

## Files

| Folder | What | Files |
|---|---|---|
| [`symbol/`](symbol/) | The three versions of the symbol, vector, transparent | `symbol-color.svg`, `symbol-monochrome.svg`, `symbol-negative.svg` |
| [`png/`](png/) | Each version as a square transparent PNG, the symbol centred at 96% of the width | `symbol-<version>-<size>.png`, sizes 16, 32, 48, 64, 128, 180, 192, 256, 512 and 1024 |
| [`ico/`](ico/) | One icon file per version, holding the PNGs of 16, 32, 48, 64, 128 and 256 | `symbol-color.ico`, `symbol-monochrome.ico`, `symbol-negative.ico` |
| [`lockup/`](lockup/) | The symbol beside or above the name, transparent, with the clear space included | `lockup-horizontal-light.svg`, `lockup-horizontal-dark.svg`, `lockup-vertical-light.svg`, `lockup-vertical-dark.svg` |

`light` and `dark` name the background a lockup is made for. The interface serves `symbol-color.svg` as `public/symbol.svg`.

## Voice

- Brand pieces are written in Brazilian Portuguese, in short affirmative sentences that end in a full stop: *"Cada nota vira um nó. Cada leitura cria uma aresta."* (Every note becomes a node. Every reading makes an edge.)
- A title is a concrete statement, not a slogan: *"Um grafo que forma um cérebro"* (A graph that forms a brain), *"O que não fazer"* (What not to do).
- The vocabulary of the brand is *nota* (note), *nó* (node), *ligação* (link), *grafo* (graph) and *cofre* (vault).
- No emoji. A middle dot (·) separates short items on one line: *MemorySmith.app · Livro da marca · v1*.
- The name is always **MemorySmith.app**: "MemorySmith" as one word, ".app" in lowercase.
- A label above a block is set in capitals.

## Colours

Six colours, used in a proportion: **background 70% · blue 18% · orange 8% · green 4%**.

| Brand colour | Value | Role | Token of the app, light theme | Token of the app, dark theme |
|---|---|---|---|---|
| Azul cofre (vault blue) | `#0F56D7` | The structure | `accent` | `accent` is `#4C8DFF` |
| Laranja sinal (signal orange) | `#FF8A2B` | The capture | `signal`, `wordmark-signal` | `signal` is `#FF9A45`; `wordmark-signal` stays `#FF8A2B` |
| Verde nó (node green) | `#16A34A` | The connection; it never leads a piece alone | `node-green` | `node-green` is `#34C97A` |
| Tinta (ink) | `#0E1526` | Text | `text`, `chosen`, `on-signal` | `on-signal` |
| Fundo escuro (dark ground) | `#0B1220` | The background of the dark theme | — | `bg`, `on-accent` |
| Papel (paper) | `#EDEFEC` | The light background | `bg` | `text`, `chosen` |

The dark theme draws in the light tones of the book's version *Cor escuro*: blue `#4C8DFF`, orange `#FF9A45`, green `#34C97A`.

## Type

- **Space Grotesk Bold** (700): the name and titles; tracking −2.5% on the name.
- **Space Grotesk Medium** (500): labels and interface.
- **Inter Regular** (400): running text; **Inter SemiBold** (600) for emphasis.

## Symbol

Laranja sinal on the left (the capture), Azul cofre on the right (the structure) and Verde nó in the connections.

- **Color** (`symbol-color.svg`): the main version. It works on a light and on a dark background.
- **Monochrome** (`symbol-monochrome.svg`): one ink, Tinta `#0E1526`, for a light background and one-colour print.
- **Negative** (`symbol-negative.svg`): one ink, white `#FFFFFF`, for a dark background and on Azul cofre.

Never redraw the symbol, and never create a colour combination outside these versions.

## Lockups

The brand signs with the symbol beside the name, in Space Grotesk Bold with −2.5% tracking. The ".app" is always Laranja sinal, on both backgrounds.

- `lockup-horizontal-light.svg`: the name in Tinta, on Papel or white.
- `lockup-horizontal-dark.svg`: the name in white, on Fundo escuro. Its symbol, as exported from Figma, is drawn in the light tones `#FF9A45`, `#4C8DFF` and `#34C97A`.
- `lockup-vertical-light.svg`, `lockup-vertical-dark.svg`: the symbol centred above the name, for a space taller than it is wide (a cover, a sign-in screen, a poster).

In digital pieces (GitHub, sites, documents), a lockup is always exported with a transparent background.

## Clear space and minimum size

- **Clear space:** x = 1/4 of the height of the symbol, all around the lockup. No text, image or edge enters it. The files of `lockup/` include it.
- **Minimum size:** the horizontal lockup at 180 px wide (32 mm in print); the symbol alone at 24 px. Below that, use the symbol alone: the legibility of the name comes before the presence of the whole lockup.

## App icon and favicon

- The icon is the symbol itself, with no container and a transparent background. The same file serves a light and a dark background: use **Color** whenever possible.
- PNG sizes: 16, 32 and 48 for the favicon and the taskbar; 180 for the iPhone home screen (`apple-touch-icon`); 192 and 512 for Android and PWA; 256 for Windows; 1024 for app stores and profile avatars.
- Where a site accepts an SVG favicon, use `symbol-color.svg`: it is sharp at any size.
- A small PNG seen enlarged always looks blurred; judge the small sizes at their real size.
- In the interface, the header shows the symbol in colour at 28 px (24 px on a phone) beside the name, on both themes.

## Misuse

- Do not distort the proportions.
- Do not rotate.
- Do not change the colours of the brand.
- Do not place it on low contrast, such as the symbol in colour on Laranja sinal.
- Do not apply a shadow or an outline.
- Do not change the space between the symbol and the name.
