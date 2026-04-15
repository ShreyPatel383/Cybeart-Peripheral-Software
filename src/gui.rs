// Nighthawk 75 — GUI Controller (Redesigned)
// Build: cargo build --release --bin nighthawk75-gui

mod device;
mod layout;
mod effects;

use device::{speed, brightness, Effect, EffectParams, Keyboard, LedMap, Rgb};
use eframe::egui;
use egui::*;
use layout::KEYS;

// ── Colour palette ─────────────────────────────────────────────────────────

const RAZER_GREEN:     Color32 = Color32::from_rgb(255,   0, 65);
const RAZER_GREEN_DIM: Color32 = Color32::from_rgb(80,   0,  20);
const BG_DEEPEST:      Color32 = Color32::from_rgb(8,   8,   10);
const BG_PANEL:        Color32 = Color32::from_rgb(14,  14,  18);
const BG_CARD:         Color32 = Color32::from_rgb(20,  20,  26);
const BG_HOVER:        Color32 = Color32::from_rgb(28,  28,  36);
const BORDER:          Color32 = Color32::from_rgb(38,  38,  50);
const BORDER_BRIGHT:   Color32 = Color32::from_rgb(70,  70,  90);
const TEXT_PRIMARY:    Color32 = Color32::from_rgb(220, 220, 230);
const TEXT_DIM:        Color32 = Color32::from_rgb(100, 100, 120);
const ACCENT_RED:      Color32 = Color32::from_rgb(255, 50,  50);

// ── App state ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
enum Page { Lighting, PerKey, Presets, Settings }

#[derive(Debug, Clone, PartialEq)]
enum EffectChoice {
    Off, Static, Breathing, Spectrum, Raindrops, Ripple,
    Twinkle, Reaction, SineWave, Rotating, Waterfall,
    FlashAway,
}

impl EffectChoice {
    fn all() -> &'static [Self] {
        use EffectChoice::*;
        &[Static, Breathing, Spectrum, Raindrops, Ripple,
          Twinkle, Reaction, SineWave, Rotating, Waterfall,
          FlashAway, Off]
    }
    fn label(&self) -> &'static str {
        use EffectChoice::*;
        match self {
            Off=>"Off", Static=>"Static", Breathing=>"Breathing",
            Spectrum=>"Spectrum Cycle", Raindrops=>"Raindrops", Ripple=>"Ripple",
            Twinkle=>"Twinkle", Reaction=>"Reaction", SineWave=>"Sine Wave",
            Rotating=>"Rotating", Waterfall=>"Waterfall",
            FlashAway=>"Flash Away",
        }
    }
    fn icon(&self) -> &'static str {
        use EffectChoice::*;
        match self {
            Off=>"⬛", Static=>"💡", Breathing=>"🫁", Spectrum=>"🌈",
            Raindrops=>"🌧", Ripple=>"💧", Twinkle=>"✨", Reaction=>"⚡",
            SineWave=>"〰", Rotating=>"🔄", Waterfall=>"🌊",
            FlashAway=>"⚡",
        }
    }
    fn to_effect(&self) -> Effect {
        use EffectChoice::*;
        match self {
            Off=>Effect::Off, Static=>Effect::Static, Breathing=>Effect::Breathing,
            Spectrum=>Effect::SpectrumCycle, Raindrops=>Effect::Raindrops,
            Ripple=>Effect::Ripple, Twinkle=>Effect::Twinkle, Reaction=>Effect::Reaction,
            SineWave=>Effect::SineWave, Rotating=>Effect::Rotating,
            Waterfall=>Effect::Waterfall, FlashAway=>Effect::FlashAway,
            
        }
    }
    fn supports_color(&self) -> bool {
        !matches!(self, EffectChoice::Spectrum | EffectChoice::Off)
    }
}

#[derive(Clone)]
struct Profile {
    name: String, effect: EffectChoice,
    color: [u8; 3], speed: u8, brightness: u8,
}

impl Profile {
    fn defaults() -> Vec<Self> {
        vec![
            Profile { name:"Nighthawk".into(), effect:EffectChoice::Static,
                color:[10,147,255], speed:2, brightness:4 },
            Profile { name:"Breathing".into(), effect:EffectChoice::Breathing,
                color:[0,255,65], speed:2, brightness:4 },
            Profile { name:"Spectrum".into(), effect:EffectChoice::Spectrum,
                color:[255,255,255], speed:2, brightness:4 },
            Profile { name:"Gaming".into(), effect:EffectChoice::Reaction,
                color:[255,30,30], speed:2, brightness:4 },
        ]
    }
}

struct NighthawkApp {
    keyboard: Option<Keyboard>, status: String, connected: bool, wireless: bool,
    page: Page,
    effect: EffectChoice, color: [f32; 3], speed: u8, brightness: u8, random_color: bool,
    per_key_map: [Color32; 96], selected_key: Option<usize>,
    pk_brush: [f32; 3], pk_eraser: bool,
    profiles: Vec<Profile>, active_profile: usize,
    toast: String, toast_ttl: f32,
    first_frame: bool,
    preview_time: f32,
}

impl Default for NighthawkApp {
    fn default() -> Self {
        Self {
            keyboard: None, status: "Disconnected".into(),
            connected: false, wireless: false,
            page: Page::Lighting,
            effect: EffectChoice::Spectrum,
            color: [0.55, 1.0, 1.0],
            speed: 2, brightness: 4, random_color: false,
            per_key_map: [Color32::BLACK; 96],
            selected_key: None,
            pk_brush: [0.33, 1.0, 1.0], pk_eraser: false,
            profiles: Profile::defaults(), active_profile: 0,
            toast: String::new(), toast_ttl: 0.0,
            first_frame: true,
            preview_time: 0.0,
        }
    }
}

// ── Colour helpers ─────────────────────────────────────────────────────────

/// Scale a colour by a brightness factor 0.0–1.0
fn dim(c: Color32, factor: f32) -> Color32 {
    let f = factor.clamp(0.0, 1.0);
    Color32::from_rgb(
        (c.r() as f32 * f) as u8,
        (c.g() as f32 * f) as u8,
        (c.b() as f32 * f) as u8,
    )
}

fn hsv_to_rgb8(h: f32, s: f32, v: f32) -> [u8; 3] {
    let h = (h % 1.0) * 360.0;
    let c = v * s; let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs()); let m = v - c;
    let (r,g,b) = if h<60.0{(c,x,0.0)}else if h<120.0{(x,c,0.0)}else if h<180.0{(0.0,c,x)}
        else if h<240.0{(0.0,x,c)}else if h<300.0{(x,0.0,c)}else{(c,0.0,x)};
    [((r+m)*255.0) as u8, ((g+m)*255.0) as u8, ((b+m)*255.0) as u8]
}

fn rgb8_to_hsv(r: u8, g: u8, b: u8) -> [f32; 3] {
    let (r,g,b) = (r as f32/255.0, g as f32/255.0, b as f32/255.0);
    let max = r.max(g).max(b); let min = r.min(g).min(b); let d = max-min;
    let s = if max==0.0{0.0}else{d/max};
    let h = if d==0.0{0.0}else if max==r{((g-b)/d)%6.0}
        else if max==g{(b-r)/d+2.0}else{(r-g)/d+4.0};
    [(h/6.0).rem_euclid(1.0), s, max]
}

fn hsv32(hsv: [f32; 3]) -> Color32 {
    let [r,g,b] = hsv_to_rgb8(hsv[0], hsv[1], hsv[2]);
    Color32::from_rgb(r,g,b)
}

// ── UI helpers ─────────────────────────────────────────────────────────────

fn sec_header(ui: &mut Ui, label: &str) {
    ui.add_space(14.0);
    ui.horizontal(|ui| {
        ui.label(RichText::new(label).color(TEXT_DIM).size(9.5).strong());
        ui.add_space(6.0);
        let w = ui.available_width();
        let (r, _) = ui.allocate_exact_size(vec2(w, 1.0), Sense::hover());
        ui.painter().rect_filled(r, 0.0, BORDER);
    });
    ui.add_space(6.0);
}

fn card(ui: &mut Ui, f: impl FnOnce(&mut Ui)) {
    Frame::none().fill(BG_CARD).stroke(Stroke::new(1.0,BORDER))
        .rounding(Rounding::same(8.0)).inner_margin(Margin::same(14.0))
        .show(ui, f);
}

fn pill(ui: &mut Ui, label: &str, active: bool) -> Response {
    let (bg, tc, bc) = if active {
        (RAZER_GREEN_DIM, RAZER_GREEN, RAZER_GREEN)
    } else {
        (BG_CARD, TEXT_DIM, BORDER)
    };
    ui.add(egui::Button::new(RichText::new(label).color(tc).size(12.0))
        .fill(bg).stroke(Stroke::new(1.0,bc)).rounding(Rounding::same(20.0))
        .min_size(vec2(32.0, 28.0)))
}

fn hsv_picker(ui: &mut Ui, hsv: &mut [f32; 3], id: &str) -> bool {
    let mut changed = false;
    let w = ui.available_width().min(200.0);

    // Hue bar
    let (hr, _) = ui.allocate_exact_size(vec2(w, 14.0), Sense::drag());
    let p = ui.painter_at(hr);
    for x in 0..hr.width() as i32 {
        let h = x as f32 / hr.width();
        let [r,g,b] = hsv_to_rgb8(h, 1.0, 1.0);
        p.rect_filled(Rect::from_min_max(
            pos2(hr.left()+x as f32, hr.top()),
            pos2(hr.left()+x as f32+1.0, hr.bottom())
        ), 0.0, Color32::from_rgb(r,g,b));
    }
    p.circle(pos2(hr.left()+hsv[0]*hr.width(), hr.center().y), 6.0,
        Color32::WHITE, Stroke::new(2.0, Color32::BLACK));
    if let Some(pos) = ui.ctx().pointer_interact_pos() {
        if hr.contains(pos) && ui.ctx().input(|i| i.pointer.primary_down()) {
            hsv[0] = ((pos.x-hr.left())/hr.width()).clamp(0.0,1.0);
            changed = true; ui.ctx().request_repaint();
        }
    }

    ui.add_space(6.0);

    // SV square
    let sh = w * 0.6;
    let (sr, _) = ui.allocate_exact_size(vec2(w, sh), Sense::drag());
    let p = ui.painter_at(sr);
    let steps = 30;
    let cw = sr.width()/steps as f32; let ch = sr.height()/steps as f32;
    for xi in 0..steps { for yi in 0..steps {
        let s = xi as f32/(steps-1) as f32; let v = 1.0 - yi as f32/(steps-1) as f32;
        let [r,g,b] = hsv_to_rgb8(hsv[0], s, v);
        let x0 = sr.left()+xi as f32*cw; let y0 = sr.top()+yi as f32*ch;
        p.rect_filled(Rect::from_min_max(pos2(x0,y0),pos2(x0+cw+1.0,y0+ch+1.0)),
            0.0, Color32::from_rgb(r,g,b));
    }}
    p.rect_stroke(sr, 4.0, Stroke::new(1.0, BORDER));
    p.circle(
        pos2(sr.left()+hsv[1]*sr.width(), sr.top()+(1.0-hsv[2])*sr.height()),
        6.0, hsv32(*hsv), Stroke::new(2.0, Color32::WHITE)
    );
    if let Some(pos) = ui.ctx().pointer_interact_pos() {
        if sr.contains(pos) && ui.ctx().input(|i| i.pointer.primary_down()) {
            hsv[1] = ((pos.x-sr.left())/sr.width()).clamp(0.0,1.0);
            hsv[2] = 1.0-((pos.y-sr.top())/sr.height()).clamp(0.0,1.0);
            changed = true; ui.ctx().request_repaint();
        }
    }
    let _ = id;
    changed
}

// ── App logic ──────────────────────────────────────────────────────────────

impl NighthawkApp {
    fn connect(&mut self) {
        match if self.wireless { Keyboard::open_wireless() } else { Keyboard::open() } {
            Ok(kb) => { self.keyboard=Some(kb); self.connected=true;
                self.status="Connected".into(); self.toast("Keyboard connected"); }
            Err(e) => { self.connected=false; self.status=format!("Error: {e}");
                self.toast(&format!("Connection failed")); }
        }
    }
    fn toast(&mut self, msg: &str) { self.toast=msg.into(); self.toast_ttl=3.0; }

    fn apply_effect(&mut self) {
        let [r,g,b] = hsv_to_rgb8(self.color[0], self.color[1], self.color[2]);
        let params = EffectParams {
            effect: self.effect.to_effect(), color: Rgb::new(r,g,b),
            speed: speed::from_step(self.speed),
            brightness: self.brightness.min(brightness::MAX), direction: 0x01,
            random_color: self.random_color,
        };
        match self.keyboard.as_ref().map(|kb| kb.set_effect(&params)) {
            Some(Ok(_))  => self.toast(&format!("Applied: {}", self.effect.label())),
            Some(Err(e)) => self.toast(&format!("Error: {e}")),
            None         => self.toast("Not connected"),
        }
    }

    fn apply_per_key(&mut self) {
        let mut map: LedMap = [Rgb::new(0,0,0); 96];
        for (i,&c) in self.per_key_map.iter().enumerate() {
            map[i] = Rgb::new(c.r(), c.g(), c.b());
        }
        match self.keyboard.as_ref().map(|kb| kb.set_per_key_rgb(&map)) {
            Some(Ok(_))  => self.toast("Per-key RGB applied"),
            Some(Err(e)) => self.toast(&format!("Error: {e}")),
            None         => self.toast("Not connected"),
        }
    }

    fn fill_all(&mut self) {
        let c = hsv32(self.pk_brush);
        self.per_key_map = [c; 96];
    }

    fn load_gaming(&mut self) {
        let m = effects::gaming_preset();
        for (i,rgb) in m.iter().enumerate() {
            self.per_key_map[i] = Color32::from_rgb(rgb.r, rgb.g, rgb.b);
        }
    }

    fn load_rainbow(&mut self) {
        let m = effects::rainbow_gradient();
        for (i,rgb) in m.iter().enumerate() {
            self.per_key_map[i] = Color32::from_rgb(rgb.r, rgb.g, rgb.b);
        }
    }
}

// ── eframe::App ────────────────────────────────────────────────────────────

impl eframe::App for NighthawkApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if self.first_frame { self.first_frame = false; self.connect(); }

        if self.toast_ttl > 0.0 {
            self.toast_ttl -= ctx.input(|i| i.unstable_dt);
            ctx.request_repaint();
        }

        // Advance preview animation time
        let dt = ctx.input(|i| i.unstable_dt);
        self.preview_time += dt;

        // Theme
        let mut v = Visuals::dark();
        v.window_fill = BG_DEEPEST; v.panel_fill = BG_PANEL;
        v.extreme_bg_color = BG_DEEPEST;
        v.widgets.inactive.bg_fill = BG_CARD;
        v.widgets.hovered.bg_fill  = BG_HOVER;
        v.widgets.active.bg_fill   = RAZER_GREEN_DIM;
        v.widgets.inactive.fg_stroke = Stroke::new(1.0, TEXT_DIM);
        v.widgets.hovered.fg_stroke  = Stroke::new(1.0, TEXT_PRIMARY);
        v.selection.bg_fill  = RAZER_GREEN_DIM;
        v.selection.stroke   = Stroke::new(1.0, RAZER_GREEN);
        v.window_rounding    = Rounding::ZERO;
        ctx.set_visuals(v);

        // Sidebar
        SidePanel::left("sidebar").exact_width(190.0).resizable(false)
            .frame(Frame::none().fill(BG_DEEPEST).stroke(Stroke::new(1.0, BORDER)))
            .show(ctx, |ui| {
                ui.set_min_height(ui.available_height());
                ui.add_space(20.0);
                ui.horizontal(|ui| {
                    ui.add_space(16.0);
                    ui.vertical(|ui| {
                        ui.label(RichText::new("NIGHTHAWK").color(RAZER_GREEN).size(15.0).strong());
                        ui.label(RichText::new("Gasket 75%").color(TEXT_DIM).size(10.0));
                    });
                });
                ui.add_space(8.0);
                ui.add(Separator::default().horizontal().spacing(0.0));
                ui.add_space(16.0);

                let items: &[(Page, &str, &str)] = &[
                    (Page::Lighting, "💡", "Lighting"),
                    (Page::PerKey,   "🎨", "Per-Key RGB"),
                    (Page::Presets,  "🎮", "Presets"),
                    (Page::Settings, "⚙",  "Settings"),
                ];
                for (page, icon, label) in items {
                    let active = &self.page == page;
                    let tc = if active { RAZER_GREEN } else { TEXT_DIM };
                    let bg = if active { BG_CARD } else { Color32::TRANSPARENT };
                    let resp = ui.add_sized(vec2(190.0, 42.0),
                        egui::Button::new(
                            RichText::new(format!("   {icon}  {label}")).color(tc).size(13.0)
                        ).fill(bg).stroke(Stroke::NONE).rounding(Rounding::ZERO));
                    if active {
                        let r = resp.rect;
                        ui.painter().rect_filled(
                            Rect::from_min_max(r.left_top(), pos2(r.left()+3.0, r.bottom())),
                            0.0, RAZER_GREEN);
                    }
                    if resp.clicked() { self.page = page.clone(); }
                }

                // Push to bottom
                let rem = ui.available_height() - 100.0;
                if rem > 0.0 { ui.add_space(rem); }
                ui.add(Separator::default().horizontal().spacing(0.0));
                ui.add_space(10.0);

                // Status
                ui.horizontal(|ui| {
                    ui.add_space(14.0);
                    let t = ctx.input(|i| i.time) as f32;
                    let a = if self.connected { ((t*2.0).sin()*0.3+0.7).clamp(0.4,1.0) } else { 1.0 };
                    let dc = if self.connected { RAZER_GREEN } else { ACCENT_RED };
                    let dot = Color32::from_rgba_unmultiplied(dc.r(),dc.g(),dc.b(),(a*255.0) as u8);
                    ui.colored_label(dot, "●");
                    let sl = if self.connected {"Connected"} else {"Disconnected"};
                    ui.label(RichText::new(sl).color(TEXT_DIM).size(11.0));
                });
                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.add_space(14.0);
                    if ui.add(egui::Button::new(
                        RichText::new(if self.connected {"Reconnect"} else {"Connect"})
                            .color(RAZER_GREEN).size(11.0))
                        .fill(RAZER_GREEN_DIM).stroke(Stroke::new(1.0,RAZER_GREEN))
                        .rounding(Rounding::same(4.0)).min_size(vec2(120.0,26.0))
                    ).clicked() { self.connect(); }
                });
                ui.add_space(14.0);
                ctx.request_repaint_after(std::time::Duration::from_millis(50));
            });

        // Toast
        if self.toast_ttl > 0.0 {
            let a = (self.toast_ttl * 85.0).min(255.0) as u8;
            egui::Area::new(Id::new("toast")).anchor(Align2::CENTER_BOTTOM, vec2(0.0,-20.0))
                .show(ctx, |ui| {
                    Frame::none()
                        .fill(Color32::from_rgba_unmultiplied(20,20,26,a))
                        .stroke(Stroke::new(1.0, Color32::from_rgba_unmultiplied(0,255,65,a)))
                        .rounding(Rounding::same(8.0))
                        .inner_margin(Margin::symmetric(16.0, 8.0))
                        .show(ui, |ui| {
                            ui.label(RichText::new(&self.toast.clone())
                                .color(Color32::from_rgba_unmultiplied(220,220,230,a)).size(12.0));
                        });
                });
        }

        // Main content
        CentralPanel::default()
            .frame(Frame::none().fill(BG_PANEL).inner_margin(Margin::ZERO))
            .show(ctx, |ui| {
                // Page header bar
                let title = match &self.page {
                    Page::Lighting => "LIGHTING EFFECTS",
                    Page::PerKey   => "PER-KEY RGB",
                    Page::Presets  => "PRESETS",
                    Page::Settings => "SETTINGS",
                };
                Frame::none().fill(BG_DEEPEST).stroke(Stroke::new(1.0,BORDER))
                    .inner_margin(Margin::symmetric(24.0, 14.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.label(RichText::new(title).color(TEXT_PRIMARY).size(12.0).strong());
                    });

                ScrollArea::vertical().auto_shrink([false;2]).show(ui, |ui| {
                    ui.set_width(ui.available_width());
                    match self.page.clone() {
                        Page::Lighting => self.page_lighting(ui),
                        Page::PerKey   => self.page_per_key(ui),
                        Page::Presets  => self.page_presets(ui),
                        Page::Settings => self.page_settings(ui),
                    }
                });
            });
    }
}

impl NighthawkApp {
    // ── Lighting ──────────────────────────────────────────────────────────

    fn page_lighting(&mut self, ui: &mut Ui) {
        ui.add_space(20.0);
        ui.horizontal_top(|ui| {
            ui.add_space(24.0);

            // Effect grid
            ui.vertical(|ui| {
                ui.set_width(230.0);
                sec_header(ui, "EFFECT");
                let effs = EffectChoice::all().to_vec();
                egui::Grid::new("eff_grid").num_columns(2).spacing([8.0,8.0]).show(ui, |ui| {
                    for (i, eff) in effs.iter().enumerate() {
                        let active = &self.effect == eff;
                        let (bg, bc, tc) = if active {
                            (RAZER_GREEN_DIM, RAZER_GREEN, RAZER_GREEN)
                        } else { (BG_CARD, BORDER, TEXT_DIM) };
                        let lbl = format!("{} {}", eff.icon(), eff.label());
                        if ui.add(egui::Button::new(RichText::new(&lbl).color(tc).size(11.0))
                            .fill(bg).stroke(Stroke::new(1.0,bc)).rounding(Rounding::same(6.0))
                            .min_size(vec2(102.0, 36.0))
                        ).clicked() { self.effect = eff.clone(); }
                        if (i+1) % 2 == 0 { ui.end_row(); }
                    }
                });

                sec_header(ui, "SPEED");
                ui.horizontal(|ui| {
                    for i in 0u8..5 {
                        if pill(ui, &(i+1).to_string(), self.speed==i).clicked() { self.speed=i; }
                    }
                });
                sec_header(ui, "BRIGHTNESS");
                ui.horizontal(|ui| {
                    for i in 0u8..5 {
                        if pill(ui, &(i+1).to_string(), self.brightness==i).clicked() { self.brightness=i; }
                    }
                });
            });

            ui.add_space(20.0);

            // Colour picker
            ui.vertical(|ui| {
                ui.set_width(210.0);
                if self.effect.supports_color() {
                    sec_header(ui, "COLOUR");
                    card(ui, |ui| {
                        ui.set_width(190.0);
                        let [r,g,b] = hsv_to_rgb8(self.color[0],self.color[1],self.color[2]);
                        let (pr, _) = ui.allocate_exact_size(vec2(190.0,28.0), Sense::hover());
                        ui.painter().rect_filled(pr, Rounding::same(6.0), Color32::from_rgb(r,g,b));
                        ui.painter().rect_stroke(pr, Rounding::same(6.0), Stroke::new(1.0,BORDER_BRIGHT));
                        ui.label(RichText::new(format!("#{r:02X}{g:02X}{b:02X}")).color(TEXT_DIM).size(11.0));
                        ui.add_space(6.0);
                        hsv_picker(ui, &mut self.color, "L");
                    });

                    sec_header(ui, "QUICK COLOURS");
                    let sw: &[(&str,[u8;3])] = &[
                        ("Nighthawk",[10,147,255]),("Red",[255,30,30]),
                        ("Green",[0,255,65]),("White",[255,255,255]),
                        ("Purple",[140,0,255]),("Cyan",[0,220,220]),
                        ("Orange",[255,120,0]),("Pink",[255,0,140]),
                    ];
                    ui.horizontal_wrapped(|ui| {
                        for (_,rgb) in sw {
                            let c = Color32::from_rgb(rgb[0],rgb[1],rgb[2]);
                            let (r,resp) = ui.allocate_exact_size(vec2(24.0,24.0), Sense::click());
                            ui.painter().rect_filled(r, Rounding::same(4.0), c);
                            ui.painter().rect_stroke(r, Rounding::same(4.0),
                                Stroke::new(1.5, if resp.hovered(){RAZER_GREEN}else{BORDER}));
                            if resp.clicked() { self.color = rgb8_to_hsv(rgb[0],rgb[1],rgb[2]); }
                        }
                    });
                }

                // Random colour toggle
                if !matches!(self.effect, EffectChoice::Spectrum | EffectChoice::Off) {
                    sec_header(ui, "COLOUR MODE");
                    ui.horizontal(|ui| {
                        if pill(ui, "Single Colour", !self.random_color).clicked() {
                            self.random_color = false;
                        }
                        if pill(ui, "🎲 Random RGB", self.random_color).clicked() {
                            self.random_color = true;
                        }
                    });
                }
            });

            ui.add_space(20.0);

            // Apply
            ui.vertical(|ui| {
                ui.add_space(28.0);
                if ui.add_sized(vec2(130.0,48.0),
                    egui::Button::new(RichText::new("▶  APPLY").color(Color32::BLACK).size(14.0).strong())
                        .fill(RAZER_GREEN).stroke(Stroke::NONE).rounding(Rounding::same(8.0))
                ).clicked() { self.apply_effect(); }

                ui.add_space(10.0);
                if ui.add_sized(vec2(130.0,36.0),
                    egui::Button::new(RichText::new("⬛  LIGHTS OFF").color(TEXT_DIM).size(11.0))
                        .fill(BG_CARD).stroke(Stroke::new(1.0,BORDER)).rounding(Rounding::same(8.0))
                ).clicked() {
                    self.effect = EffectChoice::Off;
                    self.apply_effect();
                }
            });
        });

        // Live preview
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            ui.add_space(24.0);
            ui.vertical(|ui| {
                sec_header(ui, "LIVE PREVIEW");
                card(ui, |ui| {
                    self.draw_preview(ui);
                });
            });
        });
        ui.add_space(20.0);
    }

    // ── Per-Key ───────────────────────────────────────────────────────────

    fn page_per_key(&mut self, ui: &mut Ui) {
        ui.add_space(20.0);
        ui.horizontal_top(|ui| {
            ui.add_space(24.0);

            // Controls
            ui.vertical(|ui| {
                ui.set_width(170.0);
                sec_header(ui, "BRUSH COLOUR");
                card(ui, |ui| {
                    ui.set_width(150.0);
                    let [r,g,b] = hsv_to_rgb8(self.pk_brush[0],self.pk_brush[1],self.pk_brush[2]);
                    let (pr,_) = ui.allocate_exact_size(vec2(150.0,22.0), Sense::hover());
                    ui.painter().rect_filled(pr, Rounding::same(4.0), Color32::from_rgb(r,g,b));
                    ui.painter().rect_stroke(pr, Rounding::same(4.0), Stroke::new(1.0,BORDER_BRIGHT));
                    ui.label(RichText::new(format!("#{r:02X}{g:02X}{b:02X}")).color(TEXT_DIM).size(10.0));
                    ui.add_space(5.0);
                    hsv_picker(ui, &mut self.pk_brush, "PK");
                });

                sec_header(ui, "TOOL");
                ui.horizontal(|ui| {
                    if pill(ui, "🖌 Paint", !self.pk_eraser).clicked() { self.pk_eraser=false; }
                    if pill(ui, "⬜ Erase", self.pk_eraser).clicked() { self.pk_eraser=true; }
                });

                sec_header(ui, "FILL");
                for (lbl, action) in [("Fill All", 0u8), ("Clear All", 1), ("🎮 Gaming", 2), ("🌈 Rainbow", 3)] {
                    if ui.add_sized(vec2(150.0,30.0),
                        egui::Button::new(RichText::new(lbl).color(TEXT_PRIMARY).size(11.0))
                            .fill(BG_CARD).stroke(Stroke::new(1.0,BORDER)).rounding(Rounding::same(6.0))
                    ).clicked() {
                        match action {
                            0 => self.fill_all(),
                            1 => { self.per_key_map = [Color32::BLACK;96]; },
                            2 => { self.load_gaming(); self.apply_per_key(); },
                            3 => { self.load_rainbow(); self.apply_per_key(); },
                            _ => {}
                        }
                    }
                }

                ui.add_space(14.0);
                if ui.add_sized(vec2(150.0,42.0),
                    egui::Button::new(RichText::new("▶  APPLY").color(Color32::BLACK).size(13.0).strong())
                        .fill(RAZER_GREEN).stroke(Stroke::NONE).rounding(Rounding::same(8.0))
                ).clicked() { self.apply_per_key(); }
            });

            ui.add_space(20.0);

            // Keyboard
            ui.vertical(|ui| {
                sec_header(ui, "KEYBOARD  —  click to paint");
                card(ui, |ui| { self.draw_keyboard(ui); });
                if let Some(idx) = self.selected_key {
                    if let Some(key) = KEYS.iter().find(|k| k.led_index as usize == idx) {
                        ui.add_space(6.0);
                        let c = self.per_key_map[idx];
                        ui.horizontal(|ui| {
                            ui.colored_label(Color32::from_rgb(c.r(),c.g(),c.b()), "●");
                            ui.label(RichText::new(format!(
                                "{}  (LED {})  #{:02X}{:02X}{:02X}",
                                key.name, idx, c.r(), c.g(), c.b()
                            )).color(TEXT_DIM).size(11.0));
                        });
                    }
                }
            });
        });
        ui.add_space(20.0);
    }

    fn draw_keyboard(&mut self, ui: &mut Ui) {
        let w = (ui.available_width() - 28.0).max(300.0);
        let scale = (w / 650.0).min(1.3);
        let (kb, _) = ui.allocate_exact_size(vec2(650.0*scale, 265.0*scale), Sense::hover());
        let p = ui.painter_at(kb);
        p.rect_filled(kb, Rounding::same(6.0), BG_DEEPEST);
        p.rect_stroke(kb, Rounding::same(6.0), Stroke::new(1.0, BORDER));

        let origin = kb.min;
        let ptr = ui.ctx().pointer_interact_pos();
        let clicking = ui.ctx().input(|i| i.pointer.primary_down());

        for key in KEYS.iter() {
            let li = key.led_index as usize;
            if li >= 96 || key.rect == (0,0,0,0) { continue; }
            let r = Rect::from_min_max(
                pos2(origin.x + key.rect.0 as f32 * scale,
                     origin.y + key.rect.1 as f32 * scale),
                pos2(origin.x + key.rect.2 as f32 * scale,
                     origin.y + key.rect.3 as f32 * scale),
            ).shrink(1.5);

            let kc = self.per_key_map[li];
            let is_sel = self.selected_key == Some(li);
            let is_hov = ptr.map(|p| r.contains(p)).unwrap_or(false);

            let bg = if kc == Color32::BLACK { BG_HOVER } else { kc };
            p.rect_filled(r, Rounding::same(3.0), bg);
            let bc = if is_sel { RAZER_GREEN } else if is_hov { BORDER_BRIGHT } else { BORDER };
            p.rect_stroke(r, Rounding::same(3.0), Stroke::new(if is_sel { 1.5 } else { 1.0 }, bc));

            let luma = 0.299*kc.r() as f32 + 0.587*kc.g() as f32 + 0.114*kc.b() as f32;
            let tc = if luma > 100.0 { Color32::BLACK } else { Color32::from_gray(130) };
            let fs = (r.width().min(r.height()) * 0.35).clamp(7.0, 11.0);
            p.text(r.center(), Align2::CENTER_CENTER, key.name, FontId::proportional(fs), tc);

            if is_hov && clicking {
                self.selected_key = Some(li);
                self.per_key_map[li] = if self.pk_eraser { Color32::BLACK } else { hsv32(self.pk_brush) };
                ui.ctx().request_repaint();
            }
        }
    }

    // ── Presets ───────────────────────────────────────────────────────────

    fn page_presets(&mut self, ui: &mut Ui) {
        ui.add_space(20.0);
        ui.horizontal_top(|ui| {
            ui.add_space(24.0);
            ui.vertical(|ui| {
                sec_header(ui, "PROFILES");
                let n = self.profiles.len();
                egui::Grid::new("prof_grid").num_columns(2).spacing([12.0,12.0]).show(ui, |ui| {
                    for i in 0..n {
                        let active = self.active_profile == i;
                        let bc = if active { RAZER_GREEN } else { BORDER };
                        let tc = if active { RAZER_GREEN } else { TEXT_PRIMARY };
                        let name = self.profiles[i].name.clone();
                        let eff  = self.profiles[i].effect.label();
                        let col  = { let c = self.profiles[i].color;
                            Color32::from_rgb(c[0],c[1],c[2]) };

                        Frame::none().fill(BG_CARD).stroke(Stroke::new(1.0,bc))
                            .rounding(Rounding::same(8.0)).inner_margin(Margin::same(14.0))
                            .show(ui, |ui| {
                                ui.set_min_width(190.0);
                                ui.horizontal(|ui| {
                                    ui.colored_label(col, "●");
                                    ui.label(RichText::new(&name).color(tc).size(13.0).strong());
                                });
                                ui.label(RichText::new(eff).color(TEXT_DIM).size(11.0));
                                ui.add_space(8.0);
                                if ui.add(egui::Button::new(
                                    RichText::new("Apply").color(RAZER_GREEN).size(11.0))
                                    .fill(RAZER_GREEN_DIM).stroke(Stroke::new(1.0,RAZER_GREEN))
                                    .rounding(Rounding::same(4.0))
                                ).clicked() {
                                    self.active_profile = i;
                                    let p = self.profiles[i].clone();
                                    self.effect = p.effect.clone();
                                    self.color = rgb8_to_hsv(p.color[0],p.color[1],p.color[2]);
                                    self.speed = p.speed; self.brightness = p.brightness;
                                    self.page = Page::Lighting;
                                    self.apply_effect();
                                }
                            });
                        if (i+1)%2==0 { ui.end_row(); }
                    }
                });

                sec_header(ui, "SAVE CURRENT");
                card(ui, |ui| {
                    ui.label(RichText::new("Save the current lighting setup as a new profile.")
                        .color(TEXT_DIM).size(11.0));
                    ui.add_space(8.0);
                    if ui.add(egui::Button::new(
                        RichText::new("+ Save Profile").color(RAZER_GREEN).size(12.0))
                        .fill(RAZER_GREEN_DIM).stroke(Stroke::new(1.0,RAZER_GREEN))
                        .rounding(Rounding::same(6.0)).min_size(vec2(140.0,32.0))
                    ).clicked() {
                        let [r,g,b] = hsv_to_rgb8(self.color[0],self.color[1],self.color[2]);
                        self.profiles.push(Profile {
                            name: format!("Profile {}", self.profiles.len()+1),
                            effect: self.effect.clone(), color:[r,g,b],
                            speed: self.speed, brightness: self.brightness,
                        });
                        self.toast("Profile saved");
                    }
                });
            });
        });
    }

    // ── Live Preview ──────────────────────────────────────────────────────

    fn draw_preview(&mut self, ui: &mut Ui) {
        use layout::KEYS;
        let t = self.preview_time;
        let speed_mult = 0.3 + self.speed as f32 * 0.175; // 0–4 maps to ~0.3–1.0
        let brightness = (self.brightness as f32 + 1.0) / 5.0;
        let base_col = hsv32(self.color);
        let [br, bg, bb] = hsv_to_rgb8(self.color[0], self.color[1], self.color[2]);

        // Compute per-key colour for this frame
        let mut key_colors: [Color32; 96] = [Color32::BLACK; 96];

        let effect = self.effect.clone();
        let random = self.random_color;

        // Ripple: simulate a keypress every ~2 seconds at a random key
        let ripple_period = 2.0_f32;
        let ripple_t = t * speed_mult % ripple_period;
        // Pick a pseudo-random key based on which period we're in
        let ripple_period_idx = (t * speed_mult / ripple_period) as u32;
        let ripple_key_idx = (ripple_period_idx * 37 + 13) as usize % 82;
        let ripple_key = KEYS.get(ripple_key_idx);
        let ripple_cx = ripple_key.map(|k| k.rect.0 as f32 / 650.0).unwrap_or(0.5);
        let ripple_cy = ripple_key.map(|k| k.rect.1 as f32 / 265.0).unwrap_or(0.5);

        // Waterfall: 6 rows with distinct hues scrolling downward
        let row_ys: [f32; 6] = [0.0, 55.0, 110.0, 148.0, 186.0, 223.0];

        for key in KEYS.iter() {
            let li = key.led_index as usize;
            if li >= 96 || key.rect == (0,0,0,0) { continue; }

            let kx = key.rect.0 as f32 / 650.0;
            let ky = key.rect.1 as f32 / 265.0;
            // Which row is this key in (0..5)?
            let row = row_ys.iter().enumerate()
                .min_by_key(|(_, &ry)| ((key.rect.1 as f32 - ry).abs() * 100.0) as i32)
                .map(|(i, _)| i)
                .unwrap_or(0);

            let col = match effect {
                EffectChoice::Off => Color32::BLACK,

                EffectChoice::Static => dim(base_col, brightness),

                EffectChoice::Breathing => {
                    // Whole keyboard pulses together
                    let phase = (t * speed_mult * std::f32::consts::TAU * 0.5).sin() * 0.5 + 0.5;
                    let b = phase * brightness;
                    if random { hsv32([(t * speed_mult * 0.05) % 1.0, 1.0, b])
                    } else { dim(Color32::from_rgb(br, bg, bb), b) }
                }

                EffectChoice::Spectrum => {
                    // Whole keyboard changes colour together
                    let h = (t * speed_mult * 0.07) % 1.0;
                    hsv32([h, 1.0, brightness])
                }

                EffectChoice::Raindrops => {
                    // Random individual keys light up and fade (like rain drops)
                    let seed = (li * 97 + 31) as f32;
                    let cycle = (t * speed_mult * 0.5 + seed * 0.41) % 1.0;
                    let b = if cycle < 0.25 { cycle / 0.25 }
                        else if cycle < 0.5 { 1.0 - (cycle - 0.25) / 0.25 }
                        else { 0.0 };
                    let b = b * brightness;
                    if random { hsv32([(seed * 0.019) % 1.0, 1.0, b])
                    } else { dim(Color32::from_rgb(br, bg, bb), b) }
                }

                EffectChoice::Ripple => {
                    // Wave expanding from the last "pressed" key
                    let dist = ((kx - ripple_cx).powi(2) + (ky - ripple_cy).powi(2)).sqrt();
                    let wave_radius = ripple_t / ripple_period * 2.0;
                    let ring_width = 0.15_f32;
                    let diff = (dist - wave_radius).abs();
                    let b = if diff < ring_width {
                        (1.0 - diff / ring_width) * brightness * (1.0 - ripple_t / ripple_period)
                    } else { 0.0 };
                    if random { hsv32([(dist * 0.3 + t * 0.05) % 1.0, 1.0, b])
                    } else { dim(Color32::from_rgb(br, bg, bb), b) }
                }

                EffectChoice::Twinkle => {
                    // Each key has a unique phase offset, flashes briefly once per cycle
                    let k = li as u32;
                    let h1 = k.wrapping_mul(2246822519u32) ^ k.wrapping_mul(3266489917u32);
                    let h2 = h1 ^ (h1 >> 13);
                    let h3 = h2.wrapping_mul(1274126177u32);
                    // offset: unique 0..1 per key
                    let offset = (h3 ^ (h3 >> 16)) as f32 / 4294967295.0_f32;
                    // Each key cycles at the same rate but with its own phase
                    let cycle = (t * speed_mult * 0.3 + offset) % 1.0;
                    // Flash only in the first 15% of the cycle, rest is dark
                    let b = if cycle < 0.15 {
                        let x = cycle / 0.15; // 0..1
                        let bell = 1.0 - (x * 2.0 - 1.0).powi(2); // peaks at x=0.5
                        bell * brightness
                    } else { 0.0 };
                    let hue = if random { (h1 as f32 / 4294967295.0_f32) % 1.0 }
                              else { self.color[0] };
                    hsv32([hue, 1.0, b])
                }

                EffectChoice::Reaction => {
                    // Show a "just pressed" key lighting up and fading
                    let react_period = 1.2_f32;
                    let react_t = t * speed_mult % react_period;
                    let react_key_idx = ((t * speed_mult / react_period) as u32 * 53 + 7) as usize % 82;
                    let is_active = li == KEYS.get(react_key_idx).map(|k| k.led_index as usize).unwrap_or(999);
                    let b = if is_active {
                        let fade = 1.0 - (react_t / react_period);
                        fade * brightness
                    } else { 0.0 };
                    if random { hsv32([(react_key_idx as f32 * 0.07) % 1.0, 1.0, b])
                    } else { dim(Color32::from_rgb(br, bg, bb), b) }
                }

                EffectChoice::SineWave => {
                    // A sine wave scrolling left to right — keys light up based on
                    // whether their Y position matches the wave height at their X position
                    let wave_y = (kx * 2.5 * std::f32::consts::TAU - t * speed_mult * 2.0).sin()
                        * 0.35 + 0.5; // wave oscillates between 0.15 and 0.85 in Y
                    let dist = (ky - wave_y).abs();
                    let thickness = 0.18_f32;
                    let b = (1.0 - (dist / thickness).min(1.0)) * brightness;
                    if random { hsv32([(kx + t * 0.04) % 1.0, 1.0, b])
                    } else { dim(Color32::from_rgb(br, bg, bb), b) }
                }

                EffectChoice::Rotating => {
                    // Rainbow windmill centred on keyboard centre
                    let cx = 0.5_f32; let cy = 0.5_f32;
                    let angle = (ky - cy).atan2(kx - cx); // -π to π
                    let hue = ((angle / std::f32::consts::TAU + t * speed_mult * 0.12) % 1.0 + 1.0) % 1.0;
                    hsv32([hue, 1.0, brightness])
                }

                EffectChoice::Waterfall => {
                    // Each row is a different hue, scrolling downward
                    let row_hue = (row as f32 / 6.0 + t * speed_mult * 0.08) % 1.0;
                    if random { hsv32([row_hue, 1.0, brightness])
                    } else {
                        // Tint the base colour per row
                        let h = (self.color[0] + row as f32 * 0.06) % 1.0;
                        hsv32([h, self.color[1], self.color[2] * brightness])
                    }
                }

                EffectChoice::FlashAway  => Color32::BLACK,
            };

            key_colors[li] = col;
        }

        // Draw the keyboard
        let avail_w = (ui.available_width() - 4.0).max(300.0);
        let scale = (avail_w / 650.0).min(1.2);
        let (kb, _) = ui.allocate_exact_size(vec2(650.0*scale, 265.0*scale), Sense::hover());
        let p = ui.painter_at(kb);
        p.rect_filled(kb, Rounding::same(6.0), BG_DEEPEST);
        p.rect_stroke(kb, Rounding::same(6.0), Stroke::new(1.0, BORDER));

        for key in KEYS.iter() {
            let li = key.led_index as usize;
            if li >= 96 || key.rect == (0,0,0,0) { continue; }
            let r = egui::Rect::from_min_max(
                pos2(kb.min.x + key.rect.0 as f32 * scale,
                     kb.min.y + key.rect.1 as f32 * scale),
                pos2(kb.min.x + key.rect.2 as f32 * scale,
                     kb.min.y + key.rect.3 as f32 * scale),
            ).shrink(1.5);

            let kc = key_colors[li];
            p.rect_filled(r, Rounding::same(3.0), kc);
            p.rect_stroke(r, Rounding::same(3.0), Stroke::new(1.0, BORDER));

            // Key label
            let luma = 0.299*kc.r() as f32 + 0.587*kc.g() as f32 + 0.114*kc.b() as f32;
            let tc = if luma > 80.0 { Color32::from_rgba_unmultiplied(0,0,0,180) }
                     else { Color32::from_gray(90) };
            let fs = (r.width().min(r.height()) * 0.35).clamp(6.0, 10.0);
            p.text(r.center(), egui::Align2::CENTER_CENTER, key.name,
                egui::FontId::proportional(fs), tc);
        }
    }

    // ── Settings ──────────────────────────────────────────────────────────

    fn page_settings(&mut self, ui: &mut Ui) {
        ui.add_space(20.0);
        ui.horizontal_top(|ui| {
            ui.add_space(24.0);
            ui.vertical(|ui| {
                ui.set_width(420.0);

                sec_header(ui, "CONNECTION");
                card(ui, |ui| {
                    ui.set_width(400.0);
                    ui.horizontal(|ui| {
                        ui.checkbox(&mut self.wireless, "");
                        ui.label(RichText::new("Wireless receiver (VID 0x3554 / PID 0xFA09)")
                            .color(TEXT_PRIMARY).size(12.0));
                    });
                    ui.add_space(8.0);
                    let (dc, ds) = if self.connected {
                        (RAZER_GREEN, format!("Connected — {}", self.status))
                    } else {
                        (ACCENT_RED, format!("Disconnected — {}", self.status))
                    };
                    ui.horizontal(|ui| {
                        ui.colored_label(dc, "●");
                        ui.label(RichText::new(ds).color(TEXT_DIM).size(11.0));
                    });
                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        if ui.add(egui::Button::new(RichText::new("Reconnect").color(RAZER_GREEN).size(12.0))
                            .fill(RAZER_GREEN_DIM).stroke(Stroke::new(1.0,RAZER_GREEN))
                            .rounding(Rounding::same(6.0)).min_size(vec2(100.0,30.0))
                        ).clicked() { self.connect(); }
                        if self.connected {
                            if ui.add(egui::Button::new(RichText::new("Disconnect").color(TEXT_DIM).size(12.0))
                                .fill(BG_CARD).stroke(Stroke::new(1.0,BORDER))
                                .rounding(Rounding::same(6.0)).min_size(vec2(100.0,30.0))
                            ).clicked() {
                                self.keyboard=None; self.connected=false; self.status="Disconnected".into();
                            }
                        }
                    });
                });

                sec_header(ui, "DEVICE INFO");
                card(ui, |ui| {
                    ui.set_width(400.0);
                    egui::Grid::new("devinfo").num_columns(2).spacing([16.0,4.0]).show(ui, |ui| {
                        for (k,v) in &[
                            ("Manufacturer","BY Tech"),("Model","NIGHTHAWK Gasket 75%"),
                            ("VID (wired)","0x258A"),("PID (wired)","0x010C"),
                            ("HID Interface","1  (usage_page 0xFF00)"),
                            ("Report ID","0x06"),("Packet size","520 bytes"),
                            ("Keys","82 physical + 1 wheel encoder"),
                        ] {
                            ui.label(RichText::new(*k).color(TEXT_DIM).size(11.0));
                            ui.label(RichText::new(*v).color(TEXT_PRIMARY).size(11.0));
                            ui.end_row();
                        }
                    });
                });

                sec_header(ui, "ABOUT");
                card(ui, |ui| {
                    ui.set_width(400.0);
                    ui.label(RichText::new("Nighthawk 75 Controller").color(TEXT_PRIMARY).size(13.0).strong());
                    ui.label(RichText::new(
                        "Custom open-source driver, reverse-engineered via Wireshark + USBPcap.")
                        .color(TEXT_DIM).size(11.0));
                    ui.add_space(4.0);
                    ui.label(RichText::new("All packet formats confirmed from real captures.")
                        .color(TEXT_DIM).size(11.0));
                });
            });
        });
    }
}

// ── Entry point ────────────────────────────────────────────────────────────

fn main() -> eframe::Result<()> {
    eframe::run_native(
        "Nighthawk 75",
        eframe::NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title("Nighthawk 75 — Keyboard Controller")
                .with_inner_size([940.0, 640.0])
                .with_min_inner_size([800.0, 520.0])
                .with_resizable(true),
            ..Default::default()
        },
        Box::new(|_cc| Box::new(NighthawkApp::default())),
    )
}