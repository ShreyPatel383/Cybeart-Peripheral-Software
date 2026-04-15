#[path = "../../../src/device.rs"]
mod device;
#[path = "../../../src/effects.rs"]
mod effects;
#[path = "../../../src/layout.rs"]
mod layout;

use anyhow::{anyhow, Result};
use device::{brightness, speed, Effect, EffectParams, Keyboard, Rgb};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LayoutKey {
    name: String,
    led_index: u8,
    x1: u16,
    y1: u16,
    x2: u16,
    y2: u16
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PerKeyColorInput {
    led_index: u8,
    hex_color: String
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyRebindInput {
    from_led_index: u8,
    to_led_index: u8
}

fn parse_effect(name: &str) -> Result<Effect> {
    let fx = match name {
        "Static" => Effect::Static,
        "Breathing" => Effect::Breathing,
        "Spectrum" => Effect::SpectrumCycle,
        "Raindrops" => Effect::Raindrops,
        "Ripple" => Effect::Ripple,
        "Twinkle" => Effect::Twinkle,
        "Reaction" => Effect::Reaction,
        "SineWave" => Effect::SineWave,
        "Rotating" => Effect::Rotating,
        "Waterfall" => Effect::Waterfall,
        "FlashAway" => Effect::FlashAway,
        "Off" => Effect::Off,
        other => return Err(anyhow!("Unsupported effect: {other}"))
    };
    Ok(fx)
}

fn parse_hex_rgb(hex: &str) -> Result<Rgb> {
    let value = hex.trim().trim_start_matches('#');
    if value.len() != 6 {
        return Err(anyhow!("Color must be #RRGGBB"));
    }
    let r = u8::from_str_radix(&value[0..2], 16)?;
    let g = u8::from_str_radix(&value[2..4], 16)?;
    let b = u8::from_str_radix(&value[4..6], 16)?;
    Ok(Rgb::new(r, g, b))
}

fn open_keyboard(wireless: bool) -> Result<Keyboard> {
    if wireless {
        Keyboard::open_wireless()
    } else {
        Keyboard::open()
    }
}

fn key_by_led_index(led_index: u8) -> Result<&'static layout::KeyInfo> {
    layout::KEYS
        .iter()
        .find(|key| key.led_index == led_index)
        .ok_or_else(|| anyhow!("Unknown LED index: {led_index}"))
}

#[tauri::command]
fn apply_effect(
    effect: String,
    hex_color: String,
    brightness: u8,
    speed: u8,
    wireless: bool,
    random_color: bool
) -> Result<(), String> {
    let effect_id = parse_effect(&effect).map_err(|e| e.to_string())?;
    let color = parse_hex_rgb(&hex_color).map_err(|e| e.to_string())?;
    let keyboard = open_keyboard(wireless).map_err(|e| e.to_string())?;

    keyboard
        .set_effect(&EffectParams {
            effect: effect_id,
            color,
            speed: speed::from_step(speed.min(4)),
            brightness: brightness.min(brightness::MAX),
            direction: 1,
            random_color
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn apply_preset(preset: String, wireless: bool) -> Result<(), String> {
    let keyboard = open_keyboard(wireless).map_err(|e| e.to_string())?;
    let led_map = match preset.as_str() {
        "gaming" => effects::gaming_preset(),
        "rainbow" => effects::rainbow_gradient(),
        other => return Err(format!("Unknown preset: {other}"))
    };
    keyboard.set_per_key_rgb(&led_map).map_err(|e| e.to_string())
}

#[tauri::command]
fn apply_per_key_rgb(key_colors: Vec<PerKeyColorInput>, wireless: bool) -> Result<(), String> {
    let keyboard = open_keyboard(wireless).map_err(|e| e.to_string())?;
    let mut led_map = [Rgb::OFF; 96];

    for entry in key_colors {
        let color = parse_hex_rgb(&entry.hex_color).map_err(|e| e.to_string())?;
        let idx = entry.led_index as usize;
        if idx >= led_map.len() {
            return Err(format!("LED index out of range: {}", entry.led_index));
        }
        led_map[idx] = color;
    }

    keyboard.set_per_key_rgb(&led_map).map_err(|e| e.to_string())
}

#[tauri::command]
fn remap_key_binding(binding: KeyRebindInput, wireless: bool) -> Result<(), String> {
    let keyboard = open_keyboard(wireless).map_err(|e| e.to_string())?;
    let from_key = key_by_led_index(binding.from_led_index).map_err(|e| e.to_string())?;
    let to_key = key_by_led_index(binding.to_led_index).map_err(|e| e.to_string())?;

    keyboard
        .remap_key(from_key.led_index, to_key.vk)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn ping() -> String {
    "ok".to_string()
}

#[tauri::command]
fn get_layout_keys() -> Vec<LayoutKey> {
    layout::KEYS
        .iter()
        .filter(|k| k.rect != (0, 0, 0, 0))
        .map(|k| LayoutKey {
            name: k.name.to_string(),
            led_index: k.led_index,
            x1: k.rect.0,
            y1: k.rect.1,
            x2: k.rect.2,
            y2: k.rect.3
        })
        .collect()
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            apply_effect,
            apply_preset,
            apply_per_key_rgb,
            remap_key_binding,
            ping,
            get_layout_keys
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
