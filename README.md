# Sleeve

A floating "now playing" widget for Linux, inspired by [Sleeve](https://replay.software/sleeve) for macOS.

Built with [AGS](https://github.com/Aylur/ags) (Aylur's GTK Shell) using GTK4 and the Astal libraries.

## Features

- Floating album art display in the corner of your screen
- Hover to reveal playback controls (play/pause, next, previous)
- Hover to reveal track title and artist
- Works with any MPRIS-compatible player (Spotify, browsers, VLC, etc.)
- Clean, minimal aesthetic with shadows and rounded corners

## Requirements

- AGS 3.x (built from source)
- Astal libraries (astal-io, astal4, astal-mpris)
- GTK4 and gtk4-layer-shell
- A Nerd Font for icons

## Running

```bash
./run.sh
```

Or manually:

```bash
export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
export GI_TYPELIB_PATH="/usr/local/lib/girepository-1.0:$GI_TYPELIB_PATH"
ags run .
```

## Customization

Edit `style.scss` to customize:

- `$art-size`: Album art dimensions (default: 180px)
- `$border-radius`: Corner rounding (default: 12px)
- `$bg-color`: Background color
- `$fg-color`: Text color

Edit `widget/Sleeve.tsx` to change:

- Window position (anchor to different corner)
- Margins from screen edge
- Which monitor to display on

## Project Structure

```
sleeve/
├── app.ts           # Entry point
├── style.scss       # Styles
├── widget/
│   └── Sleeve.tsx   # Main widget component
├── @girs/           # TypeScript type definitions
└── run.sh           # Helper script
```
