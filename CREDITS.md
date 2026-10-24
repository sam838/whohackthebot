# Credits

## 3D models

All 3D models are by **Kenney** ([www.kenney.nl](https://www.kenney.nl)) and released under
**Creative Commons Zero (CC0)**, a public domain dedication. Credit isn't required,
but it's given here with thanks.

| Pack | Used for | License | Source |
|---|---|---|---|
| Mini Characters 1.0 | The 12 player characters and their walk/idle animations | CC0 ([License.txt](client/public/models/characters/License.txt)) | https://kenney.nl/assets/mini-characters |
| Furniture Kit 2.0 | Desks, bookcases, tables, books, plants, fridge, trash can | CC0 ([License.txt](client/public/models/furniture/License.txt)) | https://kenney.nl/assets/furniture-kit |

Each pack's original license file is kept next to its models in `client/public/models/`.

## Fonts

[Baloo 2](https://fonts.google.com/specimen/Baloo+2) and [Nunito](https://fonts.google.com/specimen/Nunito)
from Google Fonts, under the SIL Open Font License.

## Study-Bot (mascot)

Study-Bot, the yellow robot on the title screen and menus, is an original character made for
this project. It isn't from an asset pack: it's drawn in code from simple shapes (rounded
rectangles, circles, lines) in [`TitleBackground.tsx`](client/src/screens/TitleBackground.tsx),
along with the sunburst background and speech bubble. It was designed by the project's author
with an AI coding assistant (Claude Code).

## AI-written lines

When an Anthropic API key is set, [Claude](https://www.anthropic.com/claude) writes Study-Bot's
explanations and the practice bots' meeting chat as the game runs. The game itself always
decides which answer is right and when Study-Bot lies; Claude only writes the words. Without a
key, the game uses its own pre-written lines.

## Made for this project

- The school map and layout, the painted details (chalkboard, canteen menu, floors, walls),
  which are drawn in code in [`textures.ts`](client/src/game/textures.ts)
- The question bank
- All code, built with an AI coding assistant (Claude Code)
