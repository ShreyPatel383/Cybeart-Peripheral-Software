import { invoke } from "@tauri-apps/api/tauri";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import keyboardOverlay from "./assets/keyboard-batman-transparent.png";

type EffectName =
  | "Static"
  | "Breathing"
  | "Spectrum"
  | "Raindrops"
  | "Ripple"
  | "Twinkle"
  | "Reaction"
  | "SineWave"
  | "Rotating"
  | "Waterfall"
  | "FlashAway"
  | "Off";

const effects: EffectName[] = [
  "Static",
  "Breathing",
  "Spectrum",
  "Raindrops",
  "Ripple",
  "Twinkle",
  "Reaction",
  "SineWave",
  "Rotating",
  "Waterfall",
  "FlashAway",
  "Off"
];

type LayoutKey = {
  name: string;
  ledIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type KeyOffset = {
  x: number;
  y: number;
};

type Rgb = { r: number; g: number; b: number };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rgbToCss = (c: Rgb, a = 1) => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${clamp01(a)})`;
const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  const value = h.length === 6 ? h : "ff1e2f";
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
};
const hsvToRgb = (h: number, s: number, v: number): Rgb => {
  const hh = ((h % 1) + 1) % 1 * 6;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] =
    i === 0 ? [v, t, p] :
    i === 1 ? [q, v, p] :
    i === 2 ? [p, v, t] :
    i === 3 ? [p, q, v] :
    i === 4 ? [t, p, v] : [v, p, q];
  return { r: r * 255, g: g * 255, b: b * 255 };
};
const mulRgb = (c: Rgb, k: number): Rgb => ({ r: c.r * k, g: c.g * k, b: c.b * k });
const hash01 = (a: number, b: number) => {
  let x = (a * 1664525 + b * 1013904223) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967295;
};

const KEY_POSITION_OVERRIDES: Record<string, { left: number; top: number }> = {
  Esc: { left: 3.07692, top: 10.8745 },
  F1: { left: 13.287, top: 10.8745 },
  F2: { left: 19.1657, top: 10.8745 },
  F3: { left: 25.1376, top: 10.8745 },
  F4: { left: 30.7973, top: 10.8745 },
  F5: { left: 38.0888, top: 10.8745 },
  F6: { left: 43.8743, top: 10.8745 },
  F7: { left: 49.6879, top: 10.8745 },
  F8: { left: 55.5666, top: 10.8745 },
  F9: { left: 62.8861, top: 10.8745 },
  F10: { left: 68.639, top: 10.8745 },
  F11: { left: 74.4852, top: 10.8745 },
  F12: { left: 80.4852, top: 10.8745 },
  PgDn: { left: 93.014, top: 67.2747 },
  Grave: { left: 3.16783, top: 28.7307 },
  "1": { left: 9.07692, top: 28.7307 },
  "2": { left: 14.7413, top: 28.7307 },
  "3": { left: 20.7063, top: 28.7307 },
  "4": { left: 26.5524, top: 28.7307 },
  "5": { left: 32.3077, top: 28.7307 },
  "6": { left: 38.2448, top: 28.7307 },
  "7": { left: 44, top: 28.7307 },
  "8": { left: 49.6643, top: 28.7307 },
  "9": { left: 55.6294, top: 28.7307 },
  "0": { left: 61.4755, top: 28.7307 },
  Minus: { left: 67.2308, top: 28.7307 },
  Equals: { left: 73.1678, top: 28.7307 },
  Backspace: { left: 79.2308, top: 28.7307 },
  Delete: { left: 93.1958, top: 28.7307 },
  Tab: { left: 3.44056, top: 41.1321 },
  Q: { left: 12.2727, top: 41.1321 },
  W: { left: 17.6014, top: 41.1321 },
  E: { left: 23.5385, top: 41.1321 },
  R: { left: 29.3846, top: 41.1321 },
  T: { left: 35.2308, top: 41.1321 },
  Y: { left: 41.0769, top: 41.1321 },
  U: { left: 46.9231, top: 41.1321 },
  I: { left: 52.7692, top: 41.1321 },
  O: { left: 58.6154, top: 41.1321 },
  P: { left: 64.3077, top: 41.1321 },
  LBracket: { left: 70.1538, top: 41.1321 },
  RBracket: { left: 76, top: 41.1321 },
  Backslash: { left: 81.8462, top: 41.1321 },
  End: { left: 93.1958, top: 41.1321 },
  CapsLock: { left: 3.23077, top: 54.3568 },
  A: { left: 13.4755, top: 54.3568 },
  S: { left: 19.2308, top: 54.3568 },
  D: { left: 25.014, top: 54.3568 },
  F: { left: 31.042, top: 54.3568 },
  G: { left: 36.6154, top: 54.3568 },
  H: { left: 42.5524, top: 54.3568 },
  J: { left: 48.3077, top: 54.3568 },
  K: { left: 54.0629, top: 54.3568 },
  L: { left: 60, top: 54.3568 },
  Semicolon: { left: 65.7552, top: 54.3568 },
  Quote: { left: 71.5105, top: 54.3568 },
  Enter: { left: 77.6014, top: 54.3568 },
  LShift: { left: 3.23077, top: 67.2747 },
  Z: { left: 16.3986, top: 67.2747 },
  X: { left: 22.2448, top: 67.2747 },
  C: { left: 28, top: 67.2747 },
  V: { left: 33.6923, top: 67.2747 },
  B: { left: 39.6923, top: 67.2747 },
  N: { left: 45.4755, top: 67.2747 },
  M: { left: 51.2308, top: 67.2747 },
  Comma: { left: 56.8042, top: 67.2747 },
  Period: { left: 62.9231, top: 67.2747 },
  Slash: { left: 68.6154, top: 67.2747 },
  RShift: { left: 74.3077, top: 67.2747 },
  Up: { left: 85.944, top: 69.4498 },
  LCtrl: { left: 3.07692, top: 80.3222 },
  LWin: { left: 10.5524, top: 80.3222 },
  LAlt: { left: 17.5735, top: 80.3222 },
  Space: { left: 24.7777, top: 80.3222 },
  Fn: { left: 66.9581, top: 80.3222 },
  RAlt: { left: 61.1237, top: 80.3222 },
  Left: { left: 80.0115, top: 82.5375 },
  Down: { left: 85.8228, top: 82.5375 },
  Right: { left: 91.7084, top: 82.5375 },
  PgUp: { left: 93.1049, top: 54.3568 },
  RCtrl: { left: 72.986, top: 80.3222 }
};
const KEY_WIDTH_SCALE_OVERRIDES: Record<string, number> = {
  Space: 0.935,
  RShift: 0.860
};
const KEY_WIDTH_LEFT_ANCHOR = new Set<string>(["Space"]);

type RenderKeyRectPct = { left: number; top: number; right: number; bottom: number };
type EdgeLightSeg = { x: number; y: number; w: number; h: number; color: Rgb };
type EdgeShell = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  edgeW: number;
  edgeH: number;
  color: Rgb;
};

const DEFAULT_EDGE_LAYOUT_SCALE_X = 1.49;
const EDGE_LAYOUT_SCALE_Y = 1.18;
const DEFAULT_LIGHT_BLUR_PX = 1.2;
const DEFAULT_LIGHT_THICKNESS_RATIO = 0.04;
const EDGE_THICKNESS_MIN_PCT = 0.18;
const EDGE_THICKNESS_MAX_PCT = 0.86;
const EDGE_OCCLUSION_PROBE_PCT = 0.3;
const EDGE_OCCLUSION_ENABLED = false;
const LIGHT_EDGE_INSET_PCT = 0.8;
const KEY_BOX_WIDTH_SCALE = 1.08;
const KEY_BOX_WIDTH_SCALE_OVERRIDES: Record<string, number> = { Space: 1 };

function renderedKeyBoxRect(k: LayoutKey, offsets: Record<number, KeyOffset>): RenderKeyRectPct {
  const rect = renderedKeyRect(k, offsets);
  const boxWidthScale = KEY_BOX_WIDTH_SCALE_OVERRIDES[k.name] ?? KEY_BOX_WIDTH_SCALE;
  const baseWidth = rect.right - rect.left;
  const boxWidth = baseWidth * boxWidthScale;
  const boxLeft = rect.left - (boxWidth - baseWidth) / 2;
  return {
    left: boxLeft,
    top: rect.top,
    right: boxLeft + boxWidth,
    bottom: rect.bottom
  };
}

function renderedKeyRect(k: LayoutKey, offsets: Record<number, KeyOffset>): RenderKeyRectPct {
  const override = KEY_POSITION_OVERRIDES[k.name];
  const custom = offsets[k.ledIndex] ?? { x: 0, y: 0 };
  const baseLeft = override ? override.left : (k.x1 / 650) * 100;
  const baseTop = override ? override.top : (k.y1 / 265) * 100;
  const ny = k.y1 / 265;
  const perspectiveGrow = 1 + Math.max(0, ny - 0.45) * 0.2;
  const widthScale = KEY_WIDTH_SCALE_OVERRIDES[k.name] ?? 1;
  const widthPct = (((k.x2 - k.x1) / 650) * 100) * perspectiveGrow * widthScale;
  const heightPct = (((k.y2 - k.y1) / 265) * 100) * (1 + Math.max(0, ny - 0.55) * 0.08);
  const baseWidthPct = (((k.x2 - k.x1) / 650) * 100) * perspectiveGrow;
  const left = baseLeft + custom.x + (KEY_WIDTH_LEFT_ANCHOR.has(k.name) ? 0 : (baseWidthPct - widthPct) / 2);
  const top = baseTop + custom.y;
  return { left, top, right: left + widthPct, bottom: top + heightPct };
}

function buildEdgeLightSegments(
  keys: LayoutKey[],
  offsets: Record<number, KeyOffset>,
  colorAt: (k: LayoutKey) => Rgb,
  edgeLayoutScaleX: number,
  edgeThicknessRatio: number
): EdgeLightSeg[] {
  const shells: EdgeShell[] = [];
  const subtractIntervals = (baseStart: number, baseEnd: number, blockers: Array<[number, number]>) => {
    if (baseEnd <= baseStart) return [] as Array<[number, number]>;
    if (blockers.length === 0) return [[baseStart, baseEnd]] as Array<[number, number]>;
    const merged = blockers
      .map(([s, e]) => [Math.max(baseStart, s), Math.min(baseEnd, e)] as [number, number])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    if (merged.length === 0) return [[baseStart, baseEnd]] as Array<[number, number]>;
    const out: Array<[number, number]> = [];
    let cursor = baseStart;
    for (const [s, e] of merged) {
      if (s > cursor) out.push([cursor, s]);
      cursor = Math.max(cursor, e);
      if (cursor >= baseEnd) break;
    }
    if (cursor < baseEnd) out.push([cursor, baseEnd]);
    return out;
  };

  const segments: EdgeLightSeg[] = [];
  for (const k of keys) {
    const rect = renderedKeyBoxRect(k, offsets);
    const keyW = rect.right - rect.left;
    const keyH = rect.bottom - rect.top;
    if (keyW <= 0 || keyH <= 0) continue;

    const shellW = keyW * edgeLayoutScaleX;
    const shellH = keyH * EDGE_LAYOUT_SCALE_Y;
    const shellLeft = rect.left - (shellW - keyW) / 2;
    const shellTop = rect.top - (shellH - keyH) / 2;
    const shellRight = shellLeft + shellW;
    const shellBottom = shellTop + shellH;

    const edgeW = Math.max(
      EDGE_THICKNESS_MIN_PCT,
      Math.min(EDGE_THICKNESS_MAX_PCT, shellW * edgeThicknessRatio)
    );
    const edgeH = Math.max(
      EDGE_THICKNESS_MIN_PCT,
      Math.min(EDGE_THICKNESS_MAX_PCT, shellH * edgeThicknessRatio)
    );
    shells.push({
      left: shellLeft,
      top: shellTop,
      right: shellRight,
      bottom: shellBottom,
      edgeW,
      edgeH,
      color: colorAt(k)
    });
  }

  for (const shell of shells) {
    const { left, top, right, bottom, edgeW, edgeH, color } = shell;
    const blockersTop: Array<[number, number]> = [];
    const blockersBottom: Array<[number, number]> = [];
    const blockersLeft: Array<[number, number]> = [];
    const blockersRight: Array<[number, number]> = [];
    if (EDGE_OCCLUSION_ENABLED) {
      for (const other of shells) {
        if (other === shell) continue;
        const horizontalOverlap: [number, number] = [Math.max(left, other.left), Math.min(right, other.right)];
        const verticalOverlap: [number, number] = [Math.max(top, other.top), Math.min(bottom, other.bottom)];

        const isNearTop = other.bottom >= top - EDGE_OCCLUSION_PROBE_PCT && other.top <= top + edgeH;
        if (isNearTop && horizontalOverlap[1] > horizontalOverlap[0]) blockersTop.push(horizontalOverlap);

        const isNearBottom = other.top <= bottom + EDGE_OCCLUSION_PROBE_PCT && other.bottom >= bottom - edgeH;
        if (isNearBottom && horizontalOverlap[1] > horizontalOverlap[0]) blockersBottom.push(horizontalOverlap);

        const isNearLeft = other.right >= left - EDGE_OCCLUSION_PROBE_PCT && other.left <= left + edgeW;
        if (isNearLeft && verticalOverlap[1] > verticalOverlap[0]) blockersLeft.push(verticalOverlap);

        const isNearRight = other.left <= right + EDGE_OCCLUSION_PROBE_PCT && other.right >= right - edgeW;
        if (isNearRight && verticalOverlap[1] > verticalOverlap[0]) blockersRight.push(verticalOverlap);
      }
    }

    for (const [x1, x2] of subtractIntervals(left, right, blockersTop)) {
      segments.push({ x: x1, y: top, w: x2 - x1, h: edgeH, color });
    }
    for (const [x1, x2] of subtractIntervals(left, right, blockersBottom)) {
      segments.push({ x: x1, y: bottom - edgeH, w: x2 - x1, h: edgeH, color });
    }
    const verticalInnerTop = top + edgeH;
    const verticalInnerBottom = bottom - edgeH;
    for (const [y1, y2] of subtractIntervals(verticalInnerTop, verticalInnerBottom, blockersLeft)) {
      segments.push({ x: left, y: y1, w: edgeW, h: y2 - y1, color });
    }
    for (const [y1, y2] of subtractIntervals(verticalInnerTop, verticalInnerBottom, blockersRight)) {
      segments.push({ x: right - edgeW, y: y1, w: edgeW, h: y2 - y1, color });
    }
  }
  return segments;
}

function App() {
  const [effect, setEffect] = useState<EffectName>("Static");
  const [hex, setHex] = useState("#ff1e2f");
  const [brightness, setBrightness] = useState(4);
  const [speed, setSpeed] = useState(2);
  const [wireless, setWireless] = useState(false);
  const [randomColor, setRandomColor] = useState(false);
  const layoutOffsetX = -0.1;
  const layoutOffsetY = 0.85;
  const layoutScale = 99.1;
  const layoutScaleX = 100;
  const layoutScaleY = 100;
  const layoutPadding = 0.6;
  const imageOffsetX = 0;
  const imageOffsetY = 0;
  const imageScaleX = 100;
  const imageScaleY = 100;
  const [layoutKeys, setLayoutKeys] = useState<LayoutKey[]>([]);
  const editMode = false;
  const [activeKeyId, setActiveKeyId] = useState<number | null>(null);
  const [keyOffsets, setKeyOffsets] = useState<Record<number, KeyOffset>>({});
  const [previewT, setPreviewT] = useState(0);
  const lightWidthScale = DEFAULT_EDGE_LAYOUT_SCALE_X;
  const lightThicknessRatio = DEFAULT_LIGHT_THICKNESS_RATIO;
  const lightBlurPx = DEFAULT_LIGHT_BLUR_PX;
  const [status, setStatus] = useState("Disconnected");
  const stageRef = useRef<HTMLDivElement | null>(null);

  const keyboardGlow = useMemo(
    () => ({ boxShadow: `0 0 32px ${hex}55, 0 0 8px ${hex}` }),
    [hex]
  );

  useEffect(() => {
    invoke<LayoutKey[]>("get_layout_keys")
      .then(setLayoutKeys)
      .catch((e) => setStatus(`Layout error: ${String(e)}`));
  }, []);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setPreviewT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const applyEffect = async () => {
    try {
      await invoke("apply_effect", {
        effect,
        hexColor: hex,
        brightness,
        speed,
        wireless,
        randomColor
      });
      setStatus(`Applied ${effect}`);
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    }
  };

  const applyPreset = async (preset: "gaming" | "rainbow") => {
    try {
      await invoke("apply_preset", { preset, wireless });
      setStatus(`Applied ${preset} preset`);
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    }
  };

  const checkForUpdates = async () => {
    setStatus("Checking for updates...");
    try {
      const { shouldUpdate, manifest } = await checkUpdate();
      if (!shouldUpdate) {
        setStatus("You're up to date.");
        return;
      }
      const nextVersion = manifest?.version ? ` ${manifest.version}` : "";
      setStatus(`Installing update${nextVersion}...`);
      await installUpdate();
      setStatus("Update installed. Restart the app to finish.");
    } catch (e) {
      setStatus(`Updater error: ${String(e)}`);
    }
  };

  const startKeyDrag = (event: React.PointerEvent, key: LayoutKey) => {
    if (!editMode || !stageRef.current) return;
    event.preventDefault();
    event.stopPropagation();

    const keyId = key.ledIndex;
    setActiveKeyId(keyId);

    const stageRect = stageRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = keyOffsets[keyId] ?? { x: 0, y: 0 };

    const onMove = (moveEvent: PointerEvent) => {
      const dxPct = ((moveEvent.clientX - startX) / stageRect.width) * 100;
      const dyPct = ((moveEvent.clientY - startY) / stageRect.height) * 100;
      setKeyOffsets((prev) => ({
        ...prev,
        [keyId]: { x: initial.x + dxPct, y: initial.y + dyPct }
      }));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const resetActiveKey = () => {
    if (activeKeyId === null) return;
    setKeyOffsets((prev) => {
      const next = { ...prev };
      delete next[activeKeyId];
      return next;
    });
  };

  const resetAllKeys = () => {
    setKeyOffsets({});
    setActiveKeyId(null);
  };

  const getPreviewColor = useCallback((k: LayoutKey): Rgb => {
    const nx = k.x1 / 650;
    const ny = k.y1 / 265;
    const base = hexToRgb(hex);
    const speedFactor = 0.4 + speed * 0.35;
    const brightnessFactor = (brightness + 3) / 5;
    const t = previewT * speedFactor;

    switch (effect) {
      case "Off":
        return { r: 0, g: 0, b: 0 };
      case "Static":
        return mulRgb(base, brightnessFactor);
      case "Breathing": {
        const p = (Math.sin(t * Math.PI * 2 * 0.7) + 1) / 2;
        return mulRgb(base, p * brightnessFactor);
      }
      case "Spectrum":
        return hsvToRgb((t * 0.12) % 1, 1, brightnessFactor);
      case "Raindrops": {
        const seed = (k.ledIndex * 37) % 100;
        const phase = (t * 0.6 + seed / 37) % 1;
        const pulse = phase < 0.2 ? phase / 0.2 : phase < 0.45 ? 1 - (phase - 0.2) / 0.25 : 0;
        const col = randomColor ? hsvToRgb((seed / 100 + t * 0.07) % 1, 1, 1) : base;
        return mulRgb(col, pulse * brightnessFactor);
      }
      case "Ripple": {
        if (layoutKeys.length === 0) return mulRgb(base, 0);
        const period = 1.9;
        const step = Math.floor(previewT / period);
        const phase = (previewT % period) / period;
        const animPhase = (phase * speedFactor) % 1;
        const idx = Math.floor(hash01(step, 233) * layoutKeys.length) % layoutKeys.length;
        const src = layoutKeys[idx];
        const sx = src.x1 / 650;
        const sy = src.y1 / 265;
        const dist = Math.hypot(nx - sx, ny - sy);
        const wave = animPhase * 1.45;
        const diff = Math.abs(dist - wave);
        const amp = diff < 0.12 ? 1 - diff / 0.12 : 0;
        const col = randomColor ? hsvToRgb((dist * 2 + t * 0.08) % 1, 1, 1) : base;
        return mulRgb(col, amp * brightnessFactor);
      }
      case "Twinkle": {
        if (layoutKeys.length === 0) return { r: 0, g: 0, b: 0 };
        // One new random key lights per step; older triggered keys fade out.
        const stepDuration = 0.22;
        const fadeSteps = 6;
        const currentStep = Math.floor(previewT / stepDuration);
        const phase = (previewT % stepDuration) / stepDuration;
        const animPhase = Math.min(1, phase * speedFactor);
        let amp = 0;
        let colorStep: number | undefined;

        for (let age = 0; age < fadeSteps; age++) {
          const step = currentStep - age;
          if (step < 0) continue;
          const idx = Math.floor(hash01(step, 517) * layoutKeys.length) % layoutKeys.length;
          const litLed = layoutKeys[idx].ledIndex;
          if (litLed !== k.ledIndex) continue;
          const ageFade = Math.max(0, 1 - age / fadeSteps);
          const pulse = age === 0 ? (1 - animPhase * 0.25) : 1;
          amp += ageFade * pulse;
          if (colorStep === undefined) colorStep = step;
        }

        amp = Math.min(1, amp) * brightnessFactor;
        const col = randomColor ? hsvToRgb(hash01(colorStep ?? currentStep, k.ledIndex), 1, 1) : base;
        return mulRgb(col, amp);
      }
      case "Reaction": {
        if (layoutKeys.length === 0) return mulRgb(base, 0.05);
        const period = 0.58;
        const step = Math.floor(previewT / period);
        const phase = (previewT % period) / period;
        const animPhase = Math.min(1, phase * speedFactor);
        const idx = Math.floor(hash01(step, 91) * layoutKeys.length) % layoutKeys.length;
        const activeLed = layoutKeys[idx].ledIndex;
        const isActive = activeLed === k.ledIndex;
        const amp = isActive ? 1 - animPhase : 0.04;
        const col = randomColor ? hsvToRgb((hash01(step, k.ledIndex) + animPhase * 0.2) % 1, 1, 1) : base;
        return mulRgb(col, amp * brightnessFactor);
      }
      case "SineWave": {
        const waveY = Math.sin(nx * Math.PI * 5 - t * 3.2) * 0.28 + 0.5;
        const amp = Math.max(0, 1 - Math.abs(ny - waveY) / 0.2);
        const col = randomColor ? hsvToRgb((nx + t * 0.07) % 1, 1, 1) : base;
        return mulRgb(col, amp * brightnessFactor);
      }
      case "Rotating": {
        const ang = Math.atan2(ny - 0.5, nx - 0.5) / (Math.PI * 2);
        return hsvToRgb((ang + t * 0.15) % 1, 1, brightnessFactor);
      }
      case "Waterfall":
        return hsvToRgb((ny * 0.8 + t * 0.12) % 1, randomColor ? 1 : 0.85, brightnessFactor);
      case "FlashAway": {
        if (layoutKeys.length === 0) return { r: 0, g: 0, b: 0 };
        const period = 1.15;
        const step = Math.floor(previewT / period);
        const phase = (previewT % period) / period;
        const animPhase = (phase * speedFactor) % 1;
        const idx = Math.floor(hash01(step, 711) * layoutKeys.length) % layoutKeys.length;
        const src = layoutKeys[idx];
        const sx = src.x1 / 650;
        const sy = src.y1 / 265;
        const rowGap = Math.abs(ny - sy);
        if (rowGap > 0.09) return { r: 0, g: 0, b: 0 };
        const trailHead = sx + animPhase * 0.45;
        const dist = Math.abs(nx - trailHead);
        const amp = Math.max(0, 1 - dist / 0.22) * (1 - animPhase * 0.35);
        const col = randomColor ? hsvToRgb((hash01(step, k.ledIndex) + animPhase * 0.3) % 1, 1, 1) : base;
        return mulRgb(col, amp * brightnessFactor);
      }
      default:
        return mulRgb(base, brightnessFactor);
    }
  }, [previewT, effect, hex, brightness, speed, randomColor, layoutKeys]);

  const edgeLights = useMemo(
    () => buildEdgeLightSegments(layoutKeys, keyOffsets, getPreviewColor, lightWidthScale, lightThicknessRatio),
    [layoutKeys, keyOffsets, getPreviewColor, lightWidthScale, lightThicknessRatio]
  );

  return (
    <div className="page">
      <aside className="sidebar">
        <div className="logo">NIGHTHAWK 75</div>
        <div className="group-title">KEY ASSIGNMENT</div>
        <button className="menu active">KEYBOARD</button>
        <div className="group-title">PROFILE</div>
        <button className="menu">PROFILE 1</button>
        <button className="menu">PROFILE 2</button>
        <button className="menu">PROFILE 3</button>
        <button className="menu">PROFILE 4</button>
      </aside>

      <main className="content">
        <header className="top">
          <h1>CYBEART NIGHTHAWK 75 - THE BATMAN</h1>
          <div className="modes">
            <span className="active">DEFAULT</span>
            <span>FN1</span>
            <span>FN2</span>
            <span>TAP</span>
          </div>
        </header>

        <section className="keyboard-shell" style={keyboardGlow}>
          <div className="bat-mark" />
          <div className="keyboard-stage" ref={stageRef}>
            <div
              className="keyboard-grid"
              style={{
                top: `${layoutPadding}%`,
                right: `${layoutPadding}%`,
                bottom: `${layoutPadding}%`,
                left: `${layoutPadding}%`,
                transform: `translate(${layoutOffsetX}%, ${layoutOffsetY}%) scale(${layoutScale / 100}) scaleX(${layoutScaleX / 100}) scaleY(${layoutScaleY / 100})`,
                transformOrigin: "top left"
              }}
            >
              <div
                className="keyboard-light-layer"
                style={{
                  maskImage: `url(${keyboardOverlay})`,
                  maskSize: "100% 100%",
                  maskRepeat: "no-repeat",
                  WebkitMaskImage: `url(${keyboardOverlay})`,
                  WebkitMaskSize: "100% 100%",
                  WebkitMaskRepeat: "no-repeat"
                }}
              >
                {edgeLights.map((seg, i) => {
                  const clampedLeft = Math.max(LIGHT_EDGE_INSET_PCT, seg.x);
                  const clampedTop = Math.max(LIGHT_EDGE_INSET_PCT, seg.y);
                  const clampedW = Math.max(0, Math.min(seg.w, 100 - LIGHT_EDGE_INSET_PCT - clampedLeft));
                  const clampedH = Math.max(0, Math.min(seg.h, 100 - LIGHT_EDGE_INSET_PCT - clampedTop));
                  return (
                    <div
                      key={`gap-light-${i}`}
                      className="key-light absolute-key gap-light"
                      style={{
                        left: `${clampedLeft}%`,
                        top: `${clampedTop}%`,
                        width: `${clampedW}%`,
                        height: `${clampedH}%`,
                        background: rgbToCss(seg.color, 0.78),
                        boxShadow: `0 0 20px ${rgbToCss(seg.color, 0.9)}`,
                        filter: `blur(${lightBlurPx}px) saturate(1.2)`
                      }}
                    />
                  );
                })}
              </div>
              <div className="keyboard-key-layer">
                {layoutKeys.map((k) => {
                  const rect = renderedKeyBoxRect(k, keyOffsets);
                  return (
                    <div
                      key={`${k.ledIndex}-${k.name}`}
                      className={`key absolute-key ${k.name === "Esc" ? "red" : ""}`}
                      style={{
                        left: `${rect.left}%`,
                        top: `${rect.top}%`,
                        width: `${rect.right - rect.left}%`,
                        height: `${rect.bottom - rect.top}%`,
                        cursor: editMode ? "grab" : "default",
                        outline: activeKeyId === k.ledIndex ? "1px solid #00d9ff" : undefined
                      }}
                      onPointerDown={(e) => startKeyDrag(e, k)}
                      onClick={() => setActiveKeyId(k.ledIndex)}
                    >
                      {k.name}
                    </div>
                  );
                })}
              </div>
            </div>
            <img
              src={keyboardOverlay}
              className="keyboard-overlay-image"
              style={{
                transform: `translate(${imageOffsetX}%, ${imageOffsetY}%) scaleX(${imageScaleX / 100}) scaleY(${imageScaleY / 100})`
              }}
              alt="Keyboard overlay"
            />
          </div>
        </section>

        <section className="controls">
          <label>
            Effect
            <select value={effect} onChange={(e) => setEffect(e.target.value as EffectName)}>
              {effects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Color
            <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} />
          </label>
          <label>
            Brightness
            <input type="range" min={0} max={4} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
          </label>
          <label>
            Speed
            <input type="range" min={0} max={4} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
          <label className="inline">
            <input type="checkbox" checked={wireless} onChange={(e) => setWireless(e.target.checked)} />
            Wireless
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={randomColor}
              onChange={(e) => setRandomColor(e.target.checked)}
            />
            Rainbow RGB mode
          </label>

          <button onClick={applyEffect}>Apply Effect</button>
          <button onClick={checkForUpdates}>Check for Updates</button>
          <button onClick={resetActiveKey} disabled={activeKeyId === null}>Reset Selected Key</button>
          <button onClick={resetAllKeys}>Reset All Key Offsets</button>
          <button onClick={() => applyPreset("gaming")}>Gaming Preset</button>
          <button onClick={() => applyPreset("rainbow")}>Rainbow Preset</button>
          <div className="status">{status}</div>
        </section>

        <footer className="tabs">
          <span>MOUSE</span>
          <span>KEYBOARD</span>
          <span>KEYBOARD</span>
          <span>KEYBOARD</span>
          <span>KEYBOARD</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
