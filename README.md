# KWin Auto Tile

**Author:** Pir0c0pter0 — pir0c0pter0000@gmail.com

A KWin Script for **KDE Plasma 6** that arranges windows in a grid when you explicitly trigger tiling (widget button or shortcut). It does not keep redistributing continuously in the background.

> Ported from [niri-auto-tile](https://github.com/pir0c0pter0/niri-auto-tile), originally built for the niri Wayland compositor. Also available as [`kde-auto-tile/`](https://github.com/pir0c0pter0/niri-auto-tile/tree/main/kde-auto-tile) inside the monorepo.

---

## How It Works

```
┌──────────┬──────────┬──────────┬──────────┐
│          │          │          │          │
│  Window  │  Window  │  Window  │  Window  │
│    1     │    2     │    3     │    4     │
│          │          │          │          │
└──────────┴──────────┴──────────┴──────────┘
           maxVisible = 4 (default)
```

- Click **Re-tile** (widget) or press `Meta+Ctrl+T` to reorganize now
- Each **monitor** and **virtual desktop** tiles independently
- `maxVisible` defines the maximum columns per row
- Extra windows are wrapped to additional rows instead of being pushed off-screen
- Right-click any title bar to exclude a window from tiling

## Features

- **Manual redistribution** only when you explicitly trigger re-tile
- **Configurable column count** (1-8) with keyboard shortcuts for quick switching
- **Per-monitor + per-desktop** independent tiling
- **Configurable gaps** between windows (0-32px)
- **Window class filtering** to permanently exclude apps (e.g. `plasmashell, krunner`)
- **Per-window exclusion** via right-click context menu ("Exclude from Auto-Tile")
- **Zero dependencies** — pure KWin JavaScript, no external processes

## Requirements

- **KDE Plasma 6** (KWin 6.x)
- **kpackagetool6** (included with Plasma 6)

## Installation

### From file manager (GUI)

1. Download or clone this repository
2. Open **System Settings** > **Window Management** > **KWin Scripts**
3. Click **Install from File...** and select the folder (or zip it as `.kwinscript` first)
4. Enable **Auto Tile** in the list

### From terminal

```bash
# Clone
git clone https://github.com/pir0c0pter0/kwin-auto-tile.git
cd kwin-auto-tile

# Install
kpackagetool6 --type=KWin/Script -i .

# Enable
kwriteconfig6 --file kwinrc --group Plugins --key kwin-auto-tileEnabled true

# Reload KWin to activate
qdbus6 org.kde.KWin /KWin reconfigure
```

### Updating

```bash
kpackagetool6 --type=KWin/Script -u .
qdbus6 org.kde.KWin /KWin reconfigure
```

### Uninstalling

```bash
# Disable first
kwriteconfig6 --file kwinrc --group Plugins --key kwin-auto-tileEnabled false

# Remove package
kpackagetool6 --type=KWin/Script -r kwin-auto-tile
qdbus6 org.kde.KWin /KWin reconfigure
```

## Configuration

Open **System Settings** > **Window Management** > **KWin Scripts** > click **Configure** next to Auto Tile.

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable manual tiling** | `true` | Master on/off toggle |
| **Maximum columns per row** | `4` | Max columns before windows wrap to a new row (1-8) |
| **Gap between windows** | `8 px` | Pixel gap between columns and screen edges (0-32) |
| **Exclude minimized** | `true` | Whether minimized windows are excluded from the layout |
| **Excluded window classes** | *(empty)* | Comma-separated list of window classes to never tile |

> **Note:** Changing settings requires reloading KWin: toggle the script off/on in System Settings, or run `qdbus6 org.kde.KWin /KWin reconfigure`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Meta+Ctrl+1` | Set 1 column |
| `Meta+Ctrl+2` | Set 2 columns |
| `Meta+Ctrl+3` | Set 3 columns |
| `Meta+Ctrl+4` | Set 4 columns |
| `Meta+Ctrl+T` | Force re-tile all windows |

Shortcuts can be customized in **System Settings** > **Shortcuts** > search for "Auto Tile".

## Context Menu

Right-click any window's title bar to see the **Exclude from Auto-Tile** / **Include in Auto-Tile** option. Excluded windows are ignored by the tiling algorithm until re-included or closed.

## Architecture

```
Manual trigger (widget re-tile or shortcut)
  │
  ▼
Group windows by (virtual desktop + monitor)
  │
  ▼
Sort by insertion order (stable layout)
  │
  ▼
Calculate geometry: bounded grid using max columns per row
  │
  ▼
Apply frameGeometry to each window
```

### Key design decisions

- **All tiled windows stay on-screen** by wrapping to additional rows when needed.
- **Insertion order is preserved** so windows don't jump around when other windows open/close.
- **Layout cache** prevents redundant geometry writes. The cache key includes window IDs, count, maxVisible, and gap size.

### Signals monitored

| Signal | Triggers |
|--------|----------|
| `workspace.windowAdded` | Track insertion order + invalidate cache |
| `workspace.windowRemoved` | Cleanup state + invalidate cache |

## Panel Widget (Plasmoid)

A **Plasma Widget** is included for quick access from the taskbar — click the icon to open a visual column selector, toggle manual tiling on/off, or force a re-tile.

### Installing the widget

```bash
cd kwin-auto-tile

# Install
kpackagetool6 --type=Plasma/Applet -i widget/

# Or upgrade if already installed
kpackagetool6 --type=Plasma/Applet -u widget/
```

Then right-click the panel > **Add Widgets...** > search for **Auto Tile** and drag it to the panel.

### Widget features

- **Panel icon** — shows column count as vertical bars + green status dot
- **Popup selector** — 2x2 grid to pick 1-4 columns visually
- **Enable/Disable toggle** — turns manual tiling on or off
- **Re-tile button** — forces immediate redistribution

### Uninstalling the widget

```bash
kpackagetool6 --type=Plasma/Applet -r com.github.pir0c0pter0.kwin-auto-tile-widget
```

## Project Structure

```
kwin-auto-tile/
├── metadata.json              # KWin Script metadata (Plasma 6)
├── contents/
│   ├── code/
│   │   └── main.js            # Core manual tiling logic
│   ├── config/
│   │   └── main.xml           # Configuration schema (KCfg)
│   └── ui/
│       └── config.ui          # Settings UI (Qt Designer)
├── widget/                    # Plasma Widget (Plasmoid)
│   ├── metadata.json          # Plasma/Applet metadata
│   └── contents/
│       └── ui/
│           └── main.qml       # Compact icon + popup selector
├── LICENSE
└── README.md
```

## Troubleshooting

### Script not loading after install

```bash
# Verify it's installed
kpackagetool6 --type=KWin/Script -l | grep auto-tile

# Check it's enabled in kwinrc
kreadconfig6 --file kwinrc --group Plugins --key kwin-auto-tileEnabled

# Force reload
qdbus6 org.kde.KWin /KWin reconfigure
```

### Windows not tiling

1. Check if the window is a **dialog, splash, or utility** — these are excluded by design
2. Check if the window class is in the **excluded list** in settings
3. Check if the window was manually excluded via right-click menu
4. Try `Meta+Ctrl+T` to force re-tile
5. Check KWin debug log: `journalctl --user -u plasma-kwin_wayland -f` (Wayland) or `~/.local/share/sddm/xorg-session.log` (X11)

### Script still tiling after uninstall

```bash
kwriteconfig6 --file kwinrc --group Plugins --key kwin-auto-tileEnabled false
qdbus6 org.kde.KWin /KWin reconfigure
kpackagetool6 --type=KWin/Script -l | rg auto-tile
```

### Conflicts with KDE native tiling

If you use KDE's built-in tiling zones, they may fight with this script. Disable native tiling in **System Settings** > **Window Management** > **Window Tiling** or exclude overlapping shortcuts.

### Shortcuts not working

Verify no conflicts in **System Settings** > **Shortcuts**. Search for "Auto Tile" to see all registered shortcuts and rebind if needed.

## Known Limitations

1. **No scrollable viewport** — unlike niri, KDE has a static screen, so with many windows each tile can become small.
2. **Config changes require KWin reload** — changing settings in System Settings requires toggling the script or running `qdbus6 org.kde.KWin /KWin reconfigure`.
3. **Shared maxVisible across desktops** — all virtual desktops use the same column count. Use keyboard shortcuts (`Meta+Ctrl+1-4`) for quick adjustment.

## Related Projects

- [niri-auto-tile](https://github.com/pir0c0pter0/auto-tile) — The original auto-tiling daemon for the niri compositor (+ Noctalia Shell plugin)
- [niri](https://github.com/YaLTeR/niri) — Scrollable-tiling Wayland compositor
- [Bismuth](https://github.com/Bismuth-Forge/bismuth) — Full tiling window manager for KDE (archived)
- [Polonium](https://github.com/zeroxoneafour/polonium) — Tiling manager for KDE Plasma 6
- [Krohnkite](https://github.com/esjeon/krohnkite) — Dynamic tiling for KDE (Plasma 5)

## License

[MIT](LICENSE)
