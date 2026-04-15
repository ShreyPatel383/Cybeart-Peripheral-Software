//! Built-in lighting presets

use crate::device::{Rgb, LedMap};
use crate::layout::{KEYS, gaoshou_leds};

pub mod palette {
    use crate::device::Rgb;
    pub const NIGHTHAWK_BLUE: Rgb = Rgb { r: 10, g: 147, b: 255 };
}

/// Gaming preset: WASD + arrows in Nighthawk blue, everything else dim white.
pub fn gaming_preset() -> LedMap {
    let mut map = [Rgb::new(40, 40, 40); 96];
    for idx in gaoshou_leds() {
        map[idx as usize] = palette::NIGHTHAWK_BLUE;
    }
    map
}

/// Rainbow gradient across all keys by column position.
pub fn rainbow_gradient() -> LedMap {
    let mut map = [Rgb::OFF; 96];
    let max_x = KEYS.iter().map(|k| k.rect.2).max().unwrap_or(640) as f32;
    for key in KEYS {
        let h = key.rect.0 as f32 / max_x * 360.0;
        map[key.led_index as usize] = hsv(h, 1.0, 1.0);
    }
    map
}

fn hsv(h: f32, s: f32, v: f32) -> Rgb {
    let h = h % 360.0;
    let c = v * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = v - c;
    let (r, g, b) = match h as u32 {
        0..=59   => (c, x, 0.0),
        60..=119 => (x, c, 0.0),
        120..=179 => (0.0, c, x),
        180..=239 => (0.0, x, c),
        240..=299 => (x, 0.0, c),
        _         => (c, 0.0, x),
    };
    Rgb::new(((r+m)*255.0) as u8, ((g+m)*255.0) as u8, ((b+m)*255.0) as u8)
}