/// Nighthawk 75 key layout
///
/// Maps led_index (0–95) → key name and Windows VK code.
/// Data sourced directly from KB.ini [KEY] section.
///
/// LED matrix is physically arranged in 6 rows:
///   Row 0: Esc, F1–F12                       (indices 0,12,18,24,30,36,42,48,54,60,66,72,78)
///   Row 1: `, 1–0, -, =, Backspace, Delete    (indices 1,7,13,19,25,31,37,43,49,55,61,67,73,79,91)
///   Row 2: Tab, Q–], \, End                   (indices 2,8,14,20,26,32,38,44,50,56,62,68,74,80,92)
///   Row 3: Caps, A–', Enter, PgUp             (indices 3,9,15,21,27,33,39,45,51,57,63,69,81,93)
///   Row 4: LShift, Z–/, RShift, Up, PgDn      (indices 4,10,16,22,28,34,40,46,52,58,64,82,88,94)
///   Row 5: LCtrl, LWin, LAlt, Space, RAlt,
///           Fn, RCtrl, Left, Down, Right       (indices 5,11,17,35,53,59,65,83,89,95)
///   Extra: Wheel encoder LED                   (index 90)

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct KeyInfo {
    /// Human-readable key name
    pub name: &'static str,
    /// Windows Virtual Key code
    pub vk: u16,
    /// Physical pixel position on the keyboard image (x1,y1,x2,y2)
    pub rect: (u16, u16, u16, u16),
    /// LED matrix index
    pub led_index: u8,
}

/// All 82 physical keys + 1 wheel, indexed by their K-number from KB.ini.
#[allow(dead_code)]
pub static KEYS: &[KeyInfo] = &[
    // K1  Esc
    KeyInfo { name: "Esc",       vk: 0x001B, rect: (20,27,45,54),     led_index: 0  },
    // K2  F1
    KeyInfo { name: "F1",        vk: 0x0070, rect: (90,27,115,54),    led_index: 12 },
    // K3  F2
    KeyInfo { name: "F2",        vk: 0x0071, rect: (127,27,152,54),   led_index: 18 },
    // K4  F3
    KeyInfo { name: "F3",        vk: 0x0072, rect: (164,27,189,54),   led_index: 24 },
    // K5  F4
    KeyInfo { name: "F4",        vk: 0x0073, rect: (202,27,227,54),   led_index: 30 },
    // K6  F5
    KeyInfo { name: "F5",        vk: 0x0074, rect: (250,27,275,54),   led_index: 36 },
    // K7  F6
    KeyInfo { name: "F6",        vk: 0x0075, rect: (287,27,312,54),   led_index: 42 },
    // K8  F7
    KeyInfo { name: "F7",        vk: 0x0076, rect: (326,27,351,54),   led_index: 48 },
    // K9  F8
    KeyInfo { name: "F8",        vk: 0x0077, rect: (363,27,388,54),   led_index: 54 },
    // K10 F9
    KeyInfo { name: "F9",        vk: 0x0078, rect: (413,27,438,54),   led_index: 60 },
    // K11 F10
    KeyInfo { name: "F10",       vk: 0x0079, rect: (451,27,476,54),   led_index: 66 },
    // K12 F11
    KeyInfo { name: "F11",       vk: 0x007A, rect: (489,27,514,54),   led_index: 72 },
    // K13 F12
    KeyInfo { name: "F12",       vk: 0x007B, rect: (528,27,553,54),   led_index: 78 },
    // K14 PgDn
    KeyInfo { name: "PgDn",      vk: 0x0022, rect: (604,185,629,212), led_index: 94 },
    // K15 `
    KeyInfo { name: "Grave",     vk: 0x00C0, rect: (20,72,45,99),     led_index: 1  },
    // K16 1
    KeyInfo { name: "1",         vk: 0x0031, rect: (59,72,84,99),     led_index: 7  },
    // K17 2
    KeyInfo { name: "2",         vk: 0x0032, rect: (97,72,122,99),    led_index: 13 },
    // K18 3
    KeyInfo { name: "3",         vk: 0x0033, rect: (134,72,159,99),   led_index: 19 },
    // K19 4
    KeyInfo { name: "4",         vk: 0x0034, rect: (172,72,197,99),   led_index: 25 },
    // K20 5
    KeyInfo { name: "5",         vk: 0x0035, rect: (210,72,235,99),   led_index: 31 },
    // K21 6
    KeyInfo { name: "6",         vk: 0x0036, rect: (248,72,273,99),   led_index: 37 },
    // K22 7
    KeyInfo { name: "7",         vk: 0x0037, rect: (286,72,311,99),   led_index: 43 },
    // K23 8
    KeyInfo { name: "8",         vk: 0x0038, rect: (324,72,349,99),   led_index: 49 },
    // K24 9
    KeyInfo { name: "9",         vk: 0x0039, rect: (361,72,386,99),   led_index: 55 },
    // K25 0
    KeyInfo { name: "0",         vk: 0x0030, rect: (399,72,424,99),   led_index: 61 },
    // K26 -
    KeyInfo { name: "Minus",     vk: 0x00BD, rect: (437,72,462,99),   led_index: 67 },
    // K27 =
    KeyInfo { name: "Equals",    vk: 0x00BB, rect: (475,72,500,99),   led_index: 73 },
    // K28 Backspace
    KeyInfo { name: "Backspace", vk: 0x0008, rect: (515,72,575,99),   led_index: 79 },
    // K29 Delete
    KeyInfo { name: "Delete",    vk: 0x002E, rect: (604,71,629,98),   led_index: 91 },
    // K30 Tab
    KeyInfo { name: "Tab",       vk: 0x0009, rect: (20,109,64,136),   led_index: 2  },
    // K31 Q
    KeyInfo { name: "Q",         vk: 0x0051, rect: (78,109,103,136),  led_index: 8  },
    // K32 W
    KeyInfo { name: "W",         vk: 0x0057, rect: (115,109,140,136), led_index: 14 },
    // K33 E
    KeyInfo { name: "E",         vk: 0x0045, rect: (153,109,178,136), led_index: 20 },
    // K34 R
    KeyInfo { name: "R",         vk: 0x0052, rect: (191,109,216,136), led_index: 26 },
    // K35 T
    KeyInfo { name: "T",         vk: 0x0054, rect: (229,109,254,136), led_index: 32 },
    // K36 Y
    KeyInfo { name: "Y",         vk: 0x0059, rect: (267,109,292,136), led_index: 38 },
    // K37 U
    KeyInfo { name: "U",         vk: 0x0055, rect: (305,109,330,136), led_index: 44 },
    // K38 I
    KeyInfo { name: "I",         vk: 0x0049, rect: (343,109,368,136), led_index: 50 },
    // K39 O
    KeyInfo { name: "O",         vk: 0x004F, rect: (381,109,406,136), led_index: 56 },
    // K40 P
    KeyInfo { name: "P",         vk: 0x0050, rect: (418,109,443,136), led_index: 62 },
    // K41 [
    KeyInfo { name: "LBracket",  vk: 0x00DB, rect: (456,109,481,136), led_index: 68 },
    // K42 ]
    KeyInfo { name: "RBracket",  vk: 0x00DD, rect: (494,109,519,136), led_index: 74 },
    // K43 backslash
    KeyInfo { name: "Backslash", vk: 0x00DC, rect: (532,109,576,136), led_index: 80 },
    // K44 End
    KeyInfo { name: "End",       vk: 0x0023, rect: (604,109,629,136), led_index: 92 },
    // K45 CapsLock
    KeyInfo { name: "CapsLock",  vk: 0x0014, rect: (21,147,73,174),   led_index: 3  },
    // K46 A
    KeyInfo { name: "A",         vk: 0x0041, rect: (87,147,112,174),  led_index: 9  },
    // K47 S
    KeyInfo { name: "S",         vk: 0x0053, rect: (125,147,150,174), led_index: 15 },
    // K48 D
    KeyInfo { name: "D",         vk: 0x0044, rect: (162,147,187,174), led_index: 21 },
    // K49 F
    KeyInfo { name: "F",         vk: 0x0046, rect: (200,148,225,175), led_index: 27 },
    // K50 G
    KeyInfo { name: "G",         vk: 0x0047, rect: (238,147,263,174), led_index: 33 },
    // K51 H
    KeyInfo { name: "H",         vk: 0x0048, rect: (276,147,301,174), led_index: 39 },
    // K52 J
    KeyInfo { name: "J",         vk: 0x004A, rect: (314,147,339,174), led_index: 45 },
    // K53 K
    KeyInfo { name: "K",         vk: 0x004B, rect: (352,147,377,174), led_index: 51 },
    // K54 L
    KeyInfo { name: "L",         vk: 0x004C, rect: (390,147,415,174), led_index: 57 },
    // K55 ;
    KeyInfo { name: "Semicolon", vk: 0x00BA, rect: (428,147,453,174), led_index: 63 },
    // K56 '
    KeyInfo { name: "Quote",     vk: 0x00DE, rect: (466,147,491,174), led_index: 69 },
    // K57 Enter
    KeyInfo { name: "Enter",     vk: 0x000D, rect: (505,147,575,174), led_index: 81 },
    // K58 LShift
    KeyInfo { name: "LShift",    vk: 0x00A0, rect: (21,185,93,212),   led_index: 4  },
    // K59 Z
    KeyInfo { name: "Z",         vk: 0x005A, rect: (106,185,131,212), led_index: 10 },
    // K60 X
    KeyInfo { name: "X",         vk: 0x0058, rect: (144,185,169,212), led_index: 16 },
    // K61 C
    KeyInfo { name: "C",         vk: 0x0043, rect: (182,185,207,212), led_index: 22 },
    // K62 V
    KeyInfo { name: "V",         vk: 0x0056, rect: (219,185,244,212), led_index: 28 },
    // K63 B
    KeyInfo { name: "B",         vk: 0x0042, rect: (258,186,283,213), led_index: 34 },
    // K64 N
    KeyInfo { name: "N",         vk: 0x004E, rect: (295,185,320,212), led_index: 40 },
    // K65 M
    KeyInfo { name: "M",         vk: 0x004D, rect: (333,185,358,212), led_index: 46 },
    // K66 ,
    KeyInfo { name: "Comma",     vk: 0x00BC, rect: (371,185,396,212), led_index: 52 },
    // K67 .
    KeyInfo { name: "Period",    vk: 0x00BE, rect: (409,185,434,212), led_index: 58 },
    // K68 /
    KeyInfo { name: "Slash",     vk: 0x00BF, rect: (446,185,471,212), led_index: 64 },
    // K69 RShift
    KeyInfo { name: "RShift",    vk: 0x00A1, rect: (483,185,539,212), led_index: 82 },
    // K70 Up
    KeyInfo { name: "Up",        vk: 0x0026, rect: (558,191,583,218), led_index: 88 },
    // K71 LCtrl
    KeyInfo { name: "LCtrl",     vk: 0x00A2, rect: (20,223,55,250),   led_index: 5  },
    // K72 LWin
    KeyInfo { name: "LWin",      vk: 0x005B, rect: (68,223,103,250),  led_index: 11 },
    // K73 LAlt
    KeyInfo { name: "LAlt",      vk: 0x00A4, rect: (116,224,151,251), led_index: 17 },
    // K74 Space
    KeyInfo { name: "Space",     vk: 0x0020, rect: (163,223,387,250), led_index: 35 },
    // K75 Fn
    KeyInfo { name: "Fn",        vk: 0x00FA, rect: (437,222,463,249), led_index: 59 },
    // K76 RAlt
    KeyInfo { name: "RAlt",      vk: 0x00A5, rect: (399,222,425,249), led_index: 53 },
    // K77 Left
    KeyInfo { name: "Left",      vk: 0x0025, rect: (520,229,545,256), led_index: 83 },
    // K78 Down
    KeyInfo { name: "Down",      vk: 0x0028, rect: (559,229,584,256), led_index: 89 },
    // K79 Right
    KeyInfo { name: "Right",     vk: 0x0027, rect: (596,229,621,256), led_index: 95 },
    // K80 PgUp
    KeyInfo { name: "PgUp",      vk: 0x0021, rect: (604,147,629,174), led_index: 93 },
    // K81 RCtrl
    KeyInfo { name: "RCtrl",     vk: 0x00A3, rect: (475,222,500,249), led_index: 65 },
    // K82 Wheel (encoder)
    KeyInfo { name: "Wheel",     vk: 0x0001, rect: (0,0,0,0),         led_index: 90 },
];

/// Key name → led_index lookup (case-insensitive).
#[allow(dead_code)] // used by CLI only
pub fn by_name(name: &str) -> Option<&'static KeyInfo> {
    let lower = name.to_lowercase();
    KEYS.iter().find(|k| k.name.to_lowercase() == lower)
}

/// Gaoshou (gaming highlight) default key group from KB.ini:
/// VK codes: Esc, W, A, S, D, Up, Down, Left, Right
const GAOSHOU_KEYS: &[u16] = &[0x1B, 0x57, 0x41, 0x53, 0x44, 0x26, 0x28, 0x25, 0x27];

/// Returns LED indices for the Gaoshou gaming key set.
#[allow(dead_code)] // used by CLI only
pub fn gaoshou_leds() -> Vec<u8> {
    GAOSHOU_KEYS
        .iter()
        .filter_map(|&vk| KEYS.iter().find(|k| k.vk == vk).map(|k| k.led_index))
        .collect()
}
