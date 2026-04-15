import { invoke } from "@tauri-apps/api/tauri";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cybeartLogo from "./assets/cybeart-logo.png";
import keyboardDeviceImage from "./assets/keyboard-batman-transparent.png";
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
  | "PerKeyRgb"
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
  "PerKeyRgb",
  "Off"
];
const effectLabel = (effectName: EffectName) => effectName === "PerKeyRgb" ? "Per Key RGB" : effectName;

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
type PointerPosition = { x: number; y: number };
type PerKeyColor = { ledIndex: number; hexColor: string };
type AppView = "devices" | "lighting";
type KeyRemapMap = Record<number, number>;

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
const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return "#ff1e2f";
};
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
const MATRIX_CHARS = "01アイウエオカキクケコサシスセソZXCVBNM";

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
  const [activeView, setActiveView] = useState<AppView>("devices");
  const [hex, setHex] = useState("#ff1e2f");
  const [brightness, setBrightness] = useState(4);
  const [speed, setSpeed] = useState(2);
  const [wireless, setWireless] = useState(false);
  const [randomColor, setRandomColor] = useState(false);
  const layoutOffsetX = -0.1;
  const layoutOffsetY = 0.85;
  const layoutScale = 93.8;
  const layoutScaleX = 100;
  const layoutScaleY = 100;
  const layoutPadding = 0.6;
  const imageOffsetX = 0;
  const imageOffsetY = 0;
  const imageScaleX = 94.6;
  const imageScaleY = 94.6;
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
  const pageRef = useRef<HTMLDivElement | null>(null);
  const perKeyPaintModeRef = useRef<"paint" | "erase" | null>(null);
  const [pointerPos, setPointerPos] = useState<PointerPosition | null>(null);
  const [showBoot, setShowBoot] = useState(true);
  const [perKeyColors, setPerKeyColors] = useState<Record<number, string>>({});
  const [remapBindings, setRemapBindings] = useState<KeyRemapMap>({});
  const [showRebindPrompt, setShowRebindPrompt] = useState(false);
  const [showRebindKeyboard, setShowRebindKeyboard] = useState(false);
  const [rebindTargetKeyId, setRebindTargetKeyId] = useState<number | null>(null);
  const bgDots = useMemo(
    () => {
      const columns = 28;
      const rows = 15;
      const xInset = 1.2;
      const yInset = 1.6;
      const xStep = (100 - xInset * 2) / (columns - 1);
      const yStep = (100 - yInset * 2) / (rows - 1);

      return Array.from({ length: columns * rows }, (_, i) => ({
        id: i,
        leftPct: xInset + (i % columns) * xStep,
        topPct: yInset + Math.floor(i / columns) * yStep
      }));
    },
    []
  );
  const bootColumns = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const length = 10 + (i % 4);
        const glyphs = Array.from({ length }, (_, j) => MATRIX_CHARS[(i * 7 + j * 5) % MATRIX_CHARS.length]).join("");
        return {
          id: i,
          left: 4 + i * 7.1,
          delay: (i % 5) * 0.12,
          duration: 1.1 + (i % 4) * 0.2,
          glyphs
        };
      }),
    []
  );
  const devices = useMemo(
    () => [
      {
        id: "nighthawk75",
        name: "Cybeart Nighthawk 75",
        description: "The Batman edition mechanical keyboard",
        image: keyboardDeviceImage,
        connection: wireless ? "Wireless profile ready" : "USB connected",
        status: "Online"
      }
    ],
    [wireless]
  );

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

  useEffect(() => {
    const timer = window.setTimeout(() => setShowBoot(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (layoutKeys.length === 0) return;
    setPerKeyColors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of layoutKeys) {
        if (!next[key.ledIndex]) {
          next[key.ledIndex] = normalizeHex(hex);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [layoutKeys, hex]);

  const applyEffect = async () => {
    try {
      if (effect === "PerKeyRgb") {
        const keyColors: PerKeyColor[] = layoutKeys.map((key) => ({
          ledIndex: key.ledIndex,
          hexColor: normalizeHex(perKeyColors[key.ledIndex] ?? hex)
        }));
        await invoke("apply_per_key_rgb", {
          keyColors,
          wireless
        });
        setStatus("Applied Per Key RGB");
        return;
      }
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

  const selectedPerKeyHex = activeKeyId !== null ? normalizeHex(perKeyColors[activeKeyId] ?? hex) : normalizeHex(hex);
  const activeLayoutKey = activeKeyId !== null ? layoutKeys.find((key) => key.ledIndex === activeKeyId) ?? null : null;
  const rebindTargetKey = rebindTargetKeyId !== null ? layoutKeys.find((key) => key.ledIndex === rebindTargetKeyId) ?? null : null;
  const remappedKeys = useMemo(
    () =>
      Object.entries(remapBindings)
        .map(([fromLed, toLed]) => {
          const fromKey = layoutKeys.find((key) => key.ledIndex === Number(fromLed));
          const toKey = layoutKeys.find((key) => key.ledIndex === toLed);
          if (!fromKey || !toKey) return null;
          return {
            fromLed: Number(fromLed),
            toLed,
            fromName: fromKey.name,
            toName: toKey.name
          };
        })
        .filter((item): item is { fromLed: number; toLed: number; fromName: string; toName: string } => item !== null),
    [remapBindings, layoutKeys]
  );

  const applyColorToSelectedKey = (nextHex: string) => {
    if (activeKeyId === null) return;
    const normalized = normalizeHex(nextHex);
    setPerKeyColors((prev) => ({
      ...prev,
      [activeKeyId]: normalized
    }));
  };

  const fillAllKeysWithColor = (nextHex: string) => {
    const normalized = normalizeHex(nextHex);
    setPerKeyColors(
      Object.fromEntries(layoutKeys.map((key) => [key.ledIndex, normalized]))
    );
  };

  const clearPerKeyColors = () => {
    fillAllKeysWithColor("#000000");
  };

  const paintKey = (ledIndex: number, nextHex: string) => {
    const normalized = normalizeHex(nextHex);
    setPerKeyColors((prev) => {
      if (prev[ledIndex] === normalized) return prev;
      return {
        ...prev,
        [ledIndex]: normalized
      };
    });
  };

  const stopPerKeyPainting = useCallback(() => {
    perKeyPaintModeRef.current = null;
  }, []);

  const closeRebindFlow = useCallback(() => {
    setShowRebindPrompt(false);
    setShowRebindKeyboard(false);
    setRebindTargetKeyId(null);
  }, []);

  useEffect(() => {
    window.addEventListener("pointerup", stopPerKeyPainting);
    return () => window.removeEventListener("pointerup", stopPerKeyPainting);
  }, [stopPerKeyPainting]);

  const startPerKeyPaint = (event: React.PointerEvent, key: LayoutKey) => {
    if (effect !== "PerKeyRgb") return;
    event.preventDefault();
    event.stopPropagation();

    const mode = event.button === 2 ? "erase" : "paint";
    perKeyPaintModeRef.current = mode;
    setActiveKeyId(key.ledIndex);
    paintKey(key.ledIndex, mode === "erase" ? "#000000" : hex);
  };

  const continuePerKeyPaint = (key: LayoutKey) => {
    if (effect !== "PerKeyRgb" || perKeyPaintModeRef.current === null) return;
    setActiveKeyId(key.ledIndex);
    paintKey(key.ledIndex, perKeyPaintModeRef.current === "erase" ? "#000000" : hex);
  };

  const startRebindFlow = (key: LayoutKey) => {
    setActiveKeyId(key.ledIndex);
    setRebindTargetKeyId(key.ledIndex);
    setShowRebindPrompt(true);
    setShowRebindKeyboard(false);
  };

  const openRebindKeyboard = () => {
    setShowRebindPrompt(false);
    setShowRebindKeyboard(true);
  };

  const selectRebindSourceKey = (sourceKey: LayoutKey) => {
    if (!rebindTargetKey) return;
    invoke("remap_key_binding", {
      binding: {
        fromLedIndex: rebindTargetKey.ledIndex,
        toLedIndex: sourceKey.ledIndex
      },
      wireless
    })
      .then(() => {
        setRemapBindings((prev) => {
          const next = { ...prev };
          if (rebindTargetKey.ledIndex === sourceKey.ledIndex) {
            delete next[rebindTargetKey.ledIndex];
          } else {
            next[rebindTargetKey.ledIndex] = sourceKey.ledIndex;
          }
          return next;
        });
        setStatus(`Rebound ${rebindTargetKey.name} to ${sourceKey.name}`);
      })
      .catch((error) => {
        setStatus(String(error));
      })
      .finally(() => {
        closeRebindFlow();
      });
  };

  const getPreviewColor = useCallback((k: LayoutKey): Rgb => {
    const nx = k.x1 / 650;
    const ny = k.y1 / 265;
    const base = hexToRgb(hex);
    const perKeyBase = hexToRgb(normalizeHex(perKeyColors[k.ledIndex] ?? hex));
    const speedFactor = 0.4 + speed * 0.35;
    const brightnessFactor = (brightness + 3) / 5;
    const t = previewT * speedFactor;

    switch (effect) {
      case "Off":
        return { r: 0, g: 0, b: 0 };
      case "Static":
        return mulRgb(base, brightnessFactor);
      case "PerKeyRgb":
        return mulRgb(perKeyBase, brightnessFactor);
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
  }, [previewT, effect, hex, brightness, speed, randomColor, layoutKeys, perKeyColors]);

  const edgeLights = useMemo(
    () => buildEdgeLightSegments(layoutKeys, keyOffsets, getPreviewColor, lightWidthScale, lightThicknessRatio),
    [layoutKeys, keyOffsets, getPreviewColor, lightWidthScale, lightThicknessRatio]
  );

  const handlePagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    setPointerPos({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    });
  };

  const handlePagePointerLeave = () => {
    setPointerPos(null);
  };

  return (
    <div
      className="page"
      ref={pageRef}
      onPointerMove={handlePagePointerMove}
      onPointerLeave={handlePagePointerLeave}
    >
      {showBoot && (
        <div className="boot-sequence" aria-hidden="true">
          <div className="boot-rain">
            {bootColumns.map((column) => (
              <span
                key={column.id}
                className="boot-stream"
                style={{
                  left: `${column.left}%`,
                  animationDelay: `${column.delay}s`,
                  animationDuration: `${column.duration}s`
                }}
              >
                {column.glyphs}
              </span>
            ))}
          </div>
          <div className="boot-scanline" />
          <div className="boot-center">
            <img src={cybeartLogo} alt="" className="boot-logo" />
            <div className="boot-title">CYBEART CONTROL MATRIX</div>
            <div className="boot-subtitle">SYSTEM ONLINE</div>
          </div>
        </div>
      )}
      <div className="bg-dot-layer" aria-hidden="true">
        {bgDots.map((dot) => (
          (() => {
            const dx = pointerPos ? dot.leftPct - pointerPos.x : Infinity;
            const dy = pointerPos ? dot.topPct - pointerPos.y : Infinity;
            const distance = Math.hypot(dx, dy);
            const glowRadius = 14;
            const glowStrength = pointerPos ? Math.max(0, 1 - distance / glowRadius) : 0;
            const scale = 1 + glowStrength * 1.65;
            const opacity = 0.34 + glowStrength * 0.62;
            const haloSize = 4 + glowStrength * 20;
            const coreColor = `rgba(${255 - glowStrength * 12}, ${154 + glowStrength * 56}, ${165 + glowStrength * 42}, ${0.5 + glowStrength * 0.45})`;
            const glowColor = `rgba(255, ${86 + glowStrength * 80}, ${106 + glowStrength * 42}, ${0.1 + glowStrength * 0.5})`;

            return (
              <span
                key={dot.id}
                className="bg-dot"
                style={{
                  left: `${dot.leftPct}%`,
                  top: `${dot.topPct}%`,
                  opacity,
                  transform: `translateZ(0) scale(${scale})`,
                  background: `radial-gradient(circle at 35% 35%, ${coreColor}, rgba(145, 97, 104, ${0.72 + glowStrength * 0.12}) 72%, rgba(76, 41, 48, ${0.56 + glowStrength * 0.18}) 100%)`,
                  boxShadow: `0 0 ${haloSize}px ${glowColor}, 0 0 ${haloSize * 1.7}px rgba(255, 70, 92, ${glowStrength * 0.22})`
                }}
              />
            );
          })()
        ))}
      </div>
      <aside className="sidebar">
        <div className="logo">
          <img src={cybeartLogo} alt="Cybeart" className="logo-image" />
        </div>
        <div className="group-title">DEVICE HUB</div>
        <button className={`menu ${activeView === "devices" ? "active" : ""}`} onClick={() => setActiveView("devices")}>
          DEVICES
        </button>
        {activeView === "lighting" && (
          <>
            <div className="group-title">CONTROL</div>
            <button className={`menu ${activeView === "lighting" ? "active" : ""}`} onClick={() => setActiveView("lighting")}>
              LIGHTING
            </button>
          </>
        )}
      </aside>

      <main className="content">
        {activeView === "devices" ? (
          <>
            <header className="top devices-top">
              <h1>DEVICES</h1>
              <div className="modes">
                <span className="active">DETECTED</span>
                <span>READY</span>
              </div>
            </header>

            <section className="devices-hero">
              <div>
                <div className="devices-kicker">CYBEART CONTROL CENTER</div>
                <h2>Select a device to open lighting controls.</h2>
                <p>Your connected gear appears here in a softer grid so you can jump straight into customization.</p>
              </div>
            </section>

            <section className="device-grid">
              {devices.map((device) => (
                <button
                  key={device.id}
                  className="device-card"
                  onClick={() => setActiveView("lighting")}
                >
                  <div className="device-card-image-wrap">
                    <img src={device.image} alt={device.name} className="device-card-image" />
                  </div>
                  <div className="device-card-meta">
                    <div className="device-card-row">
                      <h3>{device.name}</h3>
                      <span className="device-pill">{device.status}</span>
                    </div>
                    <p>{device.description}</p>
                    <div className="device-card-footer">
                      <span>{device.connection}</span>
                      <span>Open Lighting</span>
                    </div>
                  </div>
                </button>
              ))}
            </section>
          </>
        ) : (
          <>
            <header className="top">
              <h1>CYBEART NIGHTHAWK 75 - THE BATMAN</h1>
              <div className="modes">
                <span className="active">LIGHTING</span>
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
                  <div
                    className="keyboard-key-layer"
                    onContextMenu={(event) => {
                      if (effect === "PerKeyRgb") event.preventDefault();
                    }}
                  >
                    {layoutKeys.map((k) => {
                      const rect = renderedKeyBoxRect(k, keyOffsets);
                      const previewColor = getPreviewColor(k);
                      return (
                        <div
                          key={`${k.ledIndex}-${k.name}`}
                          className={`key absolute-key ${k.name === "Esc" && effect !== "PerKeyRgb" ? "red" : ""}`}
                          style={{
                            left: `${rect.left}%`,
                            top: `${rect.top}%`,
                            width: `${rect.right - rect.left}%`,
                            height: `${rect.bottom - rect.top}%`,
                            cursor: editMode ? "grab" : effect === "PerKeyRgb" ? "pointer" : "default",
                            outline: activeKeyId === k.ledIndex ? "1px solid #ff4558" : undefined,
                            background: effect === "PerKeyRgb" ? rgbToCss(previewColor, 0.22) : undefined,
                            boxShadow: effect === "PerKeyRgb" ? `inset 0 0 0 1px ${rgbToCss(previewColor, 0.35)}` : undefined
                          }}
                          onPointerDown={(e) => {
                            if (effect === "PerKeyRgb") {
                              startPerKeyPaint(e, k);
                              return;
                            }
                            startKeyDrag(e, k);
                          }}
                          onPointerEnter={() => continuePerKeyPaint(k)}
                          onClick={() => {
                            setActiveKeyId(k.ledIndex);
                            if (effect === "PerKeyRgb") {
                              paintKey(k.ledIndex, perKeyColors[k.ledIndex] ?? hex);
                              return;
                            }
                            startRebindFlow(k);
                          }}
                        >
                          {k.name}
                        </div>
                      );
                    })}
                  </div>
                  {showRebindPrompt && activeLayoutKey && effect !== "PerKeyRgb" && (
                    (() => {
                      const rect = renderedKeyBoxRect(activeLayoutKey, keyOffsets);
                      const popupLeft = Math.min(82, Math.max(2, rect.left + (rect.right - rect.left) / 2));
                      const popupTop = Math.max(1.5, rect.top - 11.5);
                      return (
                        <div
                          className="key-rebind-popover"
                          style={{
                            left: `${popupLeft}%`,
                            top: `${popupTop}%`
                          }}
                        >
                          <div className="key-rebind-title">Rebind key?</div>
                          <div className="key-rebind-actions">
                            <button onClick={openRebindKeyboard}>Rebind</button>
                            <button className="ghost-button" onClick={closeRebindFlow}>Cancel</button>
                          </div>
                        </div>
                      );
                    })()
                  )}
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
                      {effectLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Color
                <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} />
              </label>
              {effect === "PerKeyRgb" && (
                <label>
                  Selected Key Color
                  <input
                    type="color"
                    value={selectedPerKeyHex}
                    onChange={(e) => applyColorToSelectedKey(e.target.value)}
                    disabled={activeKeyId === null}
                  />
                </label>
              )}
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
              {effect === "PerKeyRgb" && (
                <button onClick={() => fillAllKeysWithColor(hex)}>
                  Fill All Keys
                </button>
              )}
              {effect === "PerKeyRgb" && (
                <button onClick={clearPerKeyColors}>
                  Clear Per-Key Colors
                </button>
              )}
              <button onClick={() => applyPreset("gaming")}>Gaming Preset</button>
              <button onClick={() => applyPreset("rainbow")}>Rainbow Preset</button>
              <div className="status">{status}</div>
            </section>

            <footer className="tabs">
              <span>MOUSE</span>
              <button
                type="button"
                className={`tab-button ${showRebindKeyboard ? "active" : ""}`}
                onClick={() => {
                  setShowRebindPrompt(false);
                  setShowRebindKeyboard((prev) => !prev);
                  setRebindTargetKeyId(null);
                }}
              >
                KEYBOARD
              </button>
              <span>MultiMedia</span>
              <span>Macros</span>
              <span>Commands</span>
            </footer>

            {showRebindKeyboard && (
              <section className="rebind-drawer">
                <div className="rebind-drawer-header">
                  <div className="modal-kicker">KEYBOARD</div>
                  <button className="ghost-button rebind-drawer-close" onClick={closeRebindFlow}>Close</button>
                </div>
                <p className="rebind-keyboard-subtitle">
                  {rebindTargetKey ? `Choose a new binding for ${rebindTargetKey.name}` : "Current remapped keys"}
                </p>
                <div className="remap-summary">
                  {remappedKeys.length > 0 ? (
                    remappedKeys.map((item) => (
                      <div key={`${item.fromLed}-${item.toLed}`} className="remap-chip">
                        <span>{item.fromName}</span>
                        <span>{item.toName}</span>
                      </div>
                    ))
                  ) : (
                    <div className="remap-empty">No keys are currently remapped.</div>
                  )}
                </div>
                <div className="rebind-keyboard-stage">
                  {layoutKeys.map((key) => {
                    const rect = renderedKeyBoxRect(key, {});
                    const isTarget = key.ledIndex === rebindTargetKeyId;
                    return (
                      <button
                        key={`rebind-${key.ledIndex}`}
                        className={`rebind-key ${isTarget ? "selected" : ""}`}
                        style={{
                          left: `${rect.left}%`,
                          top: `${rect.top}%`,
                          width: `${rect.right - rect.left}%`,
                          height: `${rect.bottom - rect.top}%`
                        }}
                        onClick={() => selectRebindSourceKey(key)}
                      >
                        {key.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
