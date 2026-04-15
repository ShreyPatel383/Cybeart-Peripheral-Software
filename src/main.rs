mod device;
mod layout;
mod effects;

use anyhow::{bail, Result};
use clap::{Parser, Subcommand, ValueEnum};
use device::{Effect, EffectParams, Keyboard, Rgb};
use layout::{by_name, KEYS};

#[derive(Parser, Debug)]
#[command(name = "nighthawk75", version, about = "Custom driver for the NIGHTHAWK Gasket 75% Keyboard")]
struct Cli {
    /// Use wireless receiver (VID 0x3554 / PID 0xFA09)
    #[arg(long, global = true)]
    wireless: bool,
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Show device info
    Info,
    /// Set a hardware lighting effect
    Effect {
        #[arg(value_enum)]
        effect: EffectArg,
        #[arg(short, long, default_value_t = 2)]
        speed: u8,
        #[arg(short, long, default_value_t = 4)]
        brightness: u8,
        #[arg(short, long, default_value_t = 1)]
        direction: u8,
        #[arg(short, long, default_value = "255,255,255")]
        color: String,
        #[arg(long)]
        random: bool,
    },
    /// Set all keys to a solid colour
    Solid {
        color: String,
        #[arg(short, long, default_value_t = 4)]
        brightness: u8,
    },
    /// Turn all lighting off
    Off,
    /// Set per-key RGB from a JSON file ({ "A": [255,0,0], ... })
    PerKey { file: String },
    /// Apply the built-in gaming preset (WASD + arrows highlighted)
    Gaming,
    /// Apply a left-to-right rainbow gradient
    Rainbow,
    /// Remap a key by name (not yet implemented)
    Remap { from: String, to: String },
    /// List all HID interfaces found for this keyboard
    ListDevices,
    /// List all keys and their LED indices
    ListKeys,
    /// Decode a USBPcap/Wireshark PCAP and print HID feature reports
    DecodePcap { file: String },
}

#[derive(ValueEnum, Debug, Clone, Copy)]
enum EffectArg {
    Off, Static, Breathing, Spectrum, Raindrops, Ripple, Twinkle, Reaction,
    #[value(name = "sine-wave")]   SineWave,
    Rotating, Waterfall,
    #[value(name = "flash-away")]  FlashAway,
    #[value(name = "per-key")]     PerKeyRgb,
}

impl From<EffectArg> for Effect {
    fn from(e: EffectArg) -> Self {
        match e {
            EffectArg::Off         => Effect::Off,
            EffectArg::Static      => Effect::Static,
            EffectArg::Breathing   => Effect::Breathing,
            EffectArg::Spectrum    => Effect::SpectrumCycle,
            EffectArg::Raindrops   => Effect::Raindrops,
            EffectArg::Ripple      => Effect::Ripple,
            EffectArg::Twinkle     => Effect::Twinkle,
            EffectArg::Reaction    => Effect::Reaction,
            EffectArg::SineWave    => Effect::SineWave,
            EffectArg::Rotating    => Effect::Rotating,
            EffectArg::Waterfall   => Effect::Waterfall,
            EffectArg::FlashAway   => Effect::FlashAway,
            EffectArg::PerKeyRgb   => Effect::PerKeyRgb,
        }
    }
}

fn parse_rgb(s: &str) -> Result<Rgb> {
    let p: Vec<&str> = s.split(',').collect();
    if p.len() != 3 { bail!("Colour must be R,G,B (e.g. 255,0,128)"); }
    Ok(Rgb::new(p[0].trim().parse()?, p[1].trim().parse()?, p[2].trim().parse()?))
}

fn open_keyboard(wireless: bool) -> Result<Keyboard> {
    if wireless { Keyboard::open_wireless() } else { Keyboard::open() }
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Cmd::Info => {
            let _kb = open_keyboard(cli.wireless)?;
            println!("Keyboard opened successfully.");
            println!("VID: 0x258A  PID: 0x{:04X}", if cli.wireless { 0xFA09u16 } else { 0x010Cu16 });
        }

        Cmd::ListDevices => { device::Keyboard::list_devices(); }

        Cmd::Effect { effect, speed, brightness, direction, color, random } => {
            let kb = open_keyboard(cli.wireless)?;
            let rgb = parse_rgb(&color)?;
            kb.set_effect(&EffectParams {
                effect:       Effect::from(effect),
                speed:        device::speed::from_step(speed.min(4)),
                brightness:   brightness.min(device::brightness::MAX),
                direction,
                color:        rgb,
                random_color: random,
            })?;
            println!("Effect set: {:?}  speed={speed}  brightness={brightness}  color={rgb:?}", Effect::from(effect));
        }

        Cmd::Solid { color, brightness } => {
            let kb = open_keyboard(cli.wireless)?;
            let rgb = parse_rgb(&color)?;
            kb.set_static_color(rgb, brightness.min(device::brightness::MAX))?;
            println!("Solid colour: {rgb:?}  brightness={brightness}");
        }

        Cmd::Off => {
            open_keyboard(cli.wireless)?.set_lights_off()?;
            println!("Lighting disabled.");
        }

        Cmd::PerKey { file } => {
            let kb = open_keyboard(cli.wireless)?;
            let map_raw: std::collections::HashMap<String, [u8; 3]> =
                serde_json::from_str(&std::fs::read_to_string(&file)?)?;
            let mut led_map = [Rgb::OFF; 96];
            for (name, [r, g, b]) in &map_raw {
                match by_name(name) {
                    Some(k) => led_map[k.led_index as usize] = Rgb::new(*r, *g, *b),
                    None    => eprintln!("Warning: unknown key '{name}' — skipping"),
                }
            }
            kb.set_per_key_rgb(&led_map)?;
            println!("Per-key RGB applied ({} keys).", map_raw.len());
        }

        Cmd::Gaming => {
            open_keyboard(cli.wireless)?.set_per_key_rgb(&effects::gaming_preset())?;
            println!("Gaming preset applied.");
        }

        Cmd::Rainbow => {
            open_keyboard(cli.wireless)?.set_per_key_rgb(&effects::rainbow_gradient())?;
            println!("Rainbow gradient applied.");
        }

        Cmd::Remap { from, to } => {
            let kb = open_keyboard(cli.wireless)?;
            let from_key = by_name(&from)
                .ok_or_else(|| anyhow::anyhow!("Unknown key: '{from}'"))?;
            let to_vk = if to.eq_ignore_ascii_case("none") { 0 }
                else { by_name(&to).ok_or_else(|| anyhow::anyhow!("Unknown key: '{to}'"))?.vk };
            kb.remap_key(from_key.led_index, to_vk)?;
            println!("Remapped '{}' → VK 0x{:04X}", from_key.name, to_vk);
        }

        Cmd::ListKeys => {
            println!("{:<12} {:>4}  {:>6}", "Name", "LED", "VK");
            println!("{}", "-".repeat(28));
            let mut keys = KEYS.to_vec();
            keys.sort_by_key(|k| k.led_index);
            for k in &keys {
                println!("{:<12} {:>4}  0x{:04X}", k.name, k.led_index, k.vk);
            }
        }

        Cmd::DecodePcap { file } => { decode_pcap(&file)?; }
    }
    Ok(())
}

fn decode_pcap(path: &str) -> Result<()> {
    let data = std::fs::read(path)?;
    let is_pcapng = data.starts_with(b"\x0a\x0d\x0d\x0a");
    let is_pcap = data.len() >= 4 && matches!(
        u32::from_le_bytes([data[0],data[1],data[2],data[3]]),
        0xA1B2C3D4 | 0xD4C3B2A1
    );
    if !is_pcap && !is_pcapng { anyhow::bail!("Not a valid pcap/pcapng file"); }

    println!("Format: {}  |  {} bytes", if is_pcapng { "pcapng" } else { "pcap" }, data.len());

    let known_subs = [0x04u8, 0x0a, 0x84];
    let mut found = 0usize;
    let mut i = 0;
    while i + 521 <= data.len() {
        let b = &data[i..i + 521];
        if b[0] == 0x06 && known_subs.contains(&b[1]) {
            let sub = b[1];
            println!("── offset 0x{i:08x}  sub=0x{sub:02X} ({}) ──",
                match sub { 0x0a=>"COLOR_DATA", 0x84=>"SESSION_INIT", 0x04=>"EFFECT_CFG", _=>"?" });
            if sub == 0x04 {
                println!("  effect=0x{:02X}  brt=0x{:02X}", b[0x13], b[0x07]);
            }
            for row in 0..4 {
                let s = row * 16;
                let hex: Vec<String> = b[s..s+16].iter().map(|x| format!("{x:02X}")).collect();
                let asc: String = b[s..s+16].iter().map(|&x| if (0x20..0x7f).contains(&x) { x as char } else { '.' }).collect();
                println!("  {:04x}: {}  {asc}", s, hex.join(" "));
            }
            println!();
            found += 1;
        }
        i += 1;
    }
    println!("{found} packet(s) found.");
    Ok(())
}