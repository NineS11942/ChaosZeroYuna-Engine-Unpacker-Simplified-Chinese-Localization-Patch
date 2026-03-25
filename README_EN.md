# ⚔ ChaosZero-Toolkit

**ChaosZero Nightmare (카오스제로: 나이트메어)** — data.pack Unpacker & Simplified Chinese Localization Patch

[![Language](https://img.shields.io/badge/Language-Python_3.10+-blue)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> 🌏 [中文说明](README.md)

---

## 📸 Preview

> Localization Screenshots
![Localization Preview](images/image.png)
![In-game Screenshot](images/screenshot.png)

---

## About

**The first-ever Chinese localization** for ChaosZero Nightmare.

This project includes:
- **Full `data.pack` unpacker** — extracts all 68,000+ game assets from the PLPcK encrypted archive
- **KO→ZHT text replacement** — replaces Korean text with Simplified Chinese using a TSV translation database
- **Automated rebuilder** — re-encrypts and rebuilds the multi-volume data.pack with translated content
- **One-click GUI** — modern GUI tool (CustomTkinter) with auto game detection, progress tracking, and backup

---

## For Players (One-Click Setup)

### Download

From the [Releases](../../releases) page:

- **`ChaosZero-Toolkit.exe`** — One-click localization tool (no Python required)
- **`text_ko_text.tsv`** — Chinese translation database (must be in the same folder as the exe)

### Usage

1. Download the Zip file and extract it
2. Run `ChaosZero-Toolkit.exe`
3. Click **"🔍 Auto Find"** to locate your game directory (or browse manually)
4. Click **"🚀 Start Localization"**
5. After completion, choose **Auto Replace** to apply to game directory
6. Launch the game → **Switch language/font** to see Chinese text

> ⚠ **Note**: Due to the game's hot-update mechanism, Chinese font support needs to be repackaged after each game update. The Korean version is unaffected.

---

## For Developers

### Requirements

- Python 3.10+
- `pip install numpy customtkinter`

### Core Files

| File | Description |
|------|-------------|
| `py/chaoszero_toolkit_gui.py` | GUI interface (CustomTkinter) |
| `py/rebuild_ko_to_zht.py` | Core: Extract → Translate → Rebuild data.pack |
| `py/unpack_data.py` | Core: Decrypt and extract all resources from data.pack |
| `py/text_ko_text.tsv` | Chinese translation database |

### CLI Usage

```bash
# GUI mode
python py/chaoszero_toolkit_gui.py

# Unpack (CLI)
python py/unpack_data.py -d "GameDir/appdata/cznlive" -o ./unpacked

# List files only
python py/unpack_data.py --list

# Filter extraction
python py/unpack_data.py --filter "text/"
```

---

## Technical Details

The game uses a custom **PLPcK** archive format with dual-layer encryption:

- **Outer Pack XOR**: 129-byte cyclic key (LCG seed=150812)
- **Inner XOR**: 256-byte key, applied only to `.db` files
- **Hash Index**: CDBM hash → chained bucket structure
- **Multi-Volume Split**: 1 GB per volume, seamless cross-volume read/write

### Localization Pipeline

```
data.pack → Decrypt → Extract text/ko/text.db
→ Parse inner PLPcK → Apply TSV translations
→ Rebuild + Encrypt → Write to text/zht/text.db slot
→ Stream-rebuild outer PLPcK + multi-volume output
```

### CDN Patch Mechanism

The game engine downloads language packs via CDN and merges them directly into the main PLPcK archive (not as separate append regions). The `text.pigz` index stores CDN download tags — `*` for embedded data, `lang.xxx` for CDN-sourced data.

---

## Changelog

### v1.0 (2026-03-25)
- Initial release
- Full data.pack extraction (68,000+ files)
- KO→ZHT text replacement localization
- One-click GUI + auto game detection + auto file replacement
- Supports both ZHT-downloaded and ZHT-not-downloaded modes

---

## License

MIT License — free to use, modify, and distribute.

---

## Acknowledgments

- Game engine analysis via IDA Pro reverse engineering
- PLPcK format reference: Yuna/Cocos2d-x engine

> ⭐ If this tool helped you, please give it a Star!
