# nighthawk75

Custom Rust driver for the **NIGHTHAWK Gasket 75% Mechanical Keyboard** (BY Tech).

| | |
|---|---|
| **VID (wired)** | `0x258A` |
| **PID (wired)** | `0x010C` |
| **VID/PID (wireless)** | `0x3554` / `0xFA09` — *not yet captured* |
| **HID interface** | Interface 1, usage_page `0xFF00` |
| **Transport** | HID Feature Reports (`send_feature_report`) |
| **Report ID** | `0x06` |
| **Packet size** | **520 bytes** payload (521 bytes on-wire with report-ID prefix) |

---

## Build

```powershell
cargo build --release
# Binary: target\release\nighthawk75.exe
```

---

## Usage

```
nighthawk75 [--wireless] <COMMAND>
```

### Commands

| Command | What it does |
|---|---|
| `info` | Confirm device is reachable, print protocol details |
| `effect <n> [options]` | Set a hardware lighting effect |
| `solid <R,G,B>` | All keys one solid colour |
| `off` | Turn all LEDs off |
| `per-key <file.json>` | Upload per-key RGB map ⚠️ format unconfirmed |
| `gaming` | WASD + arrows highlighted, rest dim |
| `rainbow` | Left-to-right rainbow gradient |
| `remap <from> <to>` | Key remap ⚠️ packet format unconfirmed |
| `list-keys` | Print all key names, LED indices, VK codes |
| `decode-pcap <file>` | Parse a Wireshark PCAP and decode HID packets |

### Effect names

`off` · `static` · `breathing` · `spectrum` · `wave` · `reactive` · `ripple` ·
`snake` · `rotating` · `stream-v` · `fireworks` · `flower` · `audio-bar` ·
`gaoshou` · `wheel-anim` · `happy` · `stream-h`

✅ `static` and `breathing` are PCAP-confirmed. All others use the confirmed
packet format with the correct effect IDs from KB.ini analysis.

### Examples

```powershell
nighthawk75 effect spectrum
nighthawk75 effect breathing --speed 3 --color 255,0,0
nighthawk75 solid 10,147,255
nighthawk75 effect wave --direction 1 --color 0,255,255
nighthawk75 per-key mycolors.json
nighthawk75 gaming
nighthawk75 decode-pcap capture.pcapng
nighthawk75 --wireless effect static --color 0,0,255
```

### Per-key JSON format

```json
{
  "Esc":   [255, 0,   0  ],
  "W":     [0,   255, 255],
  "A":     [0,   255, 255],
  "S":     [0,   255, 255],
  "D":     [0,   255, 255],
  "Space": [255, 255, 0  ]
}
```

Run `nighthawk75 list-keys` for all valid key names.

---

## Windows permissions

Run as **Administrator** (simplest), or use [Zadig](https://zadig.akeo.ie/) to
replace the interface-1 HID driver with WinUSB (⚠️ breaks normal keyboard input —
only do this on a dedicated test device).

---

## Confirmed Protocol ✅

> Verified against real Wireshark + USBPcap captures.

### Transport

- Interface **1**, `usage_page = 0xFF00` (vendor-defined)
- **Feature reports only** — `send_feature_report()`, NOT `write()`
- **Report ID:** `0x06`
- **Payload:** 520 bytes → 521 bytes on-wire

### Three-packet sequence

Every lighting change sends **exactly 3 feature reports** in this order:

```
1.  subcommand 0x0a  — colour data
2.  subcommand 0x84  — session init  (static, never changes)
3.  subcommand 0x04  — effect config
```

### Packet 1 — `0x0a` colour data

```
Offset  Value   Field
0x00    0x06    Report ID
0x01    0x0a    Subcommand
0x04    0x01    Profile / zone index
0x07    0x02    Unknown constant
0x1d    RR      Red   ✅ confirmed by capture diff
0x1e    GG      Green ✅ confirmed
0x1f    BB      Blue  ✅ confirmed
0x20+   …       Key layout data (constant block)
end     5A A5   Sentinel
```

### Packet 2 — `0x84` session init

```
Offset  Value   Field
0x00    0x06    Report ID
0x01    0x84    Subcommand
0x04    0x01    Unknown
0x06    0x80    Brightness (~50%)
rest    0x00    All zeroes
```

**Send byte-for-byte unchanged** — identical in every capture.

### Packet 3 — `0x04` effect config

```
Offset  Value   Field
0x00    0x06    Report ID
0x01    0x04    Subcommand
0x04    0x01    Unknown
0x06    0x80    Brightness              (suspected — only 0x80 seen)
0x09    0x03    Unknown constant
0x0a    0x03    Speed?                  (suspected — not confirmed)
0x0b    0x01    Direction?              (suspected — not confirmed)
0x12    EE      Effect ID  ✅ confirmed by capture diff
0x40+   …       Key layout data (constant block)
end     5A A5   Sentinel
```

### Effect IDs

| ID | Effect | Source |
|----|--------|--------|
| `0x01` | Static | ✅ PCAP |
| `0x02` | Breathing | ✅ PCAP |
| `0x03` | Spectrum cycle | KB.ini |
| `0x05` | Wave | KB.ini |
| `0x07` | Reactive | KB.ini |
| `0x08` | Ripple | KB.ini |
| `0x0C` | Snake | KB.ini |
| `0x0D` | Rotating | KB.ini |
| `0x0E` | Stream (vertical) | KB.ini |
| `0x0F` | Fireworks | KB.ini |
| `0x10` | Flower | KB.ini |
| `0x11` | Audio bar | KB.ini |
| `0x12` | Gaoshou | KB.ini |
| `0x13` | Per-key RGB | KB.ini |
| `0x1C` | Wheel animation | KB.ini |
| `0x1D` | Happy | KB.ini |
| `0x1E` | Stream (horizontal) | KB.ini |

---

## Known Unknowns — capture these to fill the gaps

| Unknown | How to capture |
|---------|----------------|
| Speed byte (`0x0a`) | Change speed slider in OemDrv, diff `0x04` packet |
| Direction byte (`0x0b`) | Toggle direction, diff `0x04` packet |
| Brightness byte (`0x06`) | Change brightness, diff `0x04` packet |
| Per-key RGB format | Apply custom per-key colours (effect `0x13`) |
| Profile switching | Switch profiles, look for new subcommand |
| Key remap | Remap one key, look for new packet subcommand |
| Macros | Record and apply a macro |
| Side/underglow LEDs | Toggle underglow (LedMask=0x22020 in KB.ini) |
| Wireless | Capture with dongle (VID `0x3554` / PID `0xFA09`) |

### Capture workflow

```
1. Wireshark → USBPcap interface → filter: usb.transfer_type == 0x02
2. Make ONE change in OemDrv.exe
3. File → Export Specified Packets → save.pcapng
4. nighthawk75 decode-pcap save.pcapng
5. Compare offsets that changed vs the previous capture
```

Packets to look for: **556-byte** Wireshark entries (36-byte USB header + 520-byte payload).
The payload starts at offset `0x24` in the raw capture bytes.

---

## Project structure

```
nighthawk75/
├── Cargo.toml
└── src/
    ├── main.rs     — CLI (clap), all commands, PCAP decoder
    ├── device.rs   — HID protocol: confirmed packet format, Keyboard struct
    ├── layout.rs   — 82 keys, LED indices, VK codes, row groups
    └── effects.rs  — Animation groups, colour presets, LedMap helpers
```
