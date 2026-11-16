# Hive Keeper 🐝

A browser game: a bee defends her hive from wasps. 10 levels across 7 changing landscapes, 9 kinds of wasps, three multi-phase bosses (levels 5, 8 and 10), 35 upgrades in four rarities, permanent Hive Lab boosts, awards, three difficulty levels, an endless mode, a short interactive tutorial, a victory celebration, and music and sounds generated in code – a different tune for every level and every boss.

## How to open
Double-click `index.html`. Nothing to install, no internet needed.

## Files
- `index.html` – structure and menus
- `style.css` – styling
- `icon.svg` – browser tab icon
- `js/core.js` – helpers, saved settings and profile, difficulty, high scores
- `js/audio.js` – sound effects and the music sequencer (no audio files): 10 level tracks, 3 boss tracks, menu and victory music
- `js/data.js` – wasps, bosses, level plans, upgrades, lab perks, awards
- `js/world.js` – canvas, screen size, graphics quality, landscapes
- `js/game.js` – game rules: the bee, waves, wasp and boss behaviour, the tutorial, the honey shop
- `js/render.js` – all drawing: insects, hive, particles, weather, lighting
- `js/ui.js` – input (keyboard, mouse, touch), screens, HUD, shop, settings, tutorial card, victory screen
- `js/main.js` – main loop and start-up
- `backup-before-upgrade/` – the game exactly as it was before the big upgrade
- `hebrew-backup/` – a copy of the earlier Hebrew version

## Controls
- **Computer:** arrow keys or WASD (or hold the mouse), Space for the buzz wave, Shift to dash, P or Esc to pause, M to mute. On the upgrade screen: 1–3 pick a card, R rerolls.
- **Phone:** drag a finger anywhere like a joystick; the big button is the buzz wave and the small one is the dash. A second finger can press them while the first keeps steering. Settings has a left-handed layout.

## First game
The first time you start, a one-minute tutorial teaches flying, stinging, collecting honey, the buzz wave and the dash. Nothing can hurt you in it and you can skip it. Replay it any time from "How to play".

## What is saved (in the browser, localStorage)
- The current run, at the start of every level – return with "Continue".
- High scores.
- Your profile: royal jelly, Hive Lab boosts, awards, the wasp guide and lifetime statistics.
- Settings: music and sound volume, graphics quality, screen shake, vibration.
- Whether you have finished the tutorial.

Settings → "Reset all progress" erases everything. Beating level 10 unlocks endless mode.

## Tips
- Stay close to the hive: the bee stings the nearest wasp, and wasps that are stinging the hive come first.
- Spare honey? In the shop between levels, "Fortify hive" and "Toughen bee" raise maximum health for the rest of the run.
- Each boss arrives a few seconds into its level – use the opening to clear the first wasps.
- Hornets flash before they lunge – dash through.
- Shield wasps block stings from the front: get behind them or break the shield with a buzz wave.
- Take out nurse wasps first; catch robber wasps before they leave with your honey.
- The Wasp Queen can be staggered if you hit her hard while she winds up a dive at the hive.
- The Wasp General is exposed right after a charge and after a buzz wave.
