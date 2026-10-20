/**
 * Space pixel characters — "classic" style (the first version: soft 24×37 chibis, no hard
 * outline, big dark eyes with a white catch-light, blush, socks + shoes).
 *
 * Symmetric layers are written as 12-col LEFT HALVES and mirrored. Asymmetric layers
 * (like LAYYI's red + blonde sections) are painted with column segments via `seg()`.
 */
import type { AvatarConfig } from "./db";

export const AV_W = 24;
export const AV_H = 37;

type Layer = string[];
const EMPTY = ".".repeat(AV_W);

const mirror = (rows: string[]) => rows.map((l) => (l + l.split("").reverse().join("")).slice(0, AV_W));
function half(spec: Record<number, string>): Layer {
  const out: string[] = [];
  for (let r = 0; r < AV_H; r++) out.push(spec[r] ?? "............");
  return mirror(out);
}
function range(a: number, b: number, row: string) {
  const o: Record<number, string> = {};
  for (let r = a; r <= b; r++) o[r] = row;
  return o;
}
/** Paint column segments: { row: [[startCol, "chars"], …] }. "." leaves the cell empty. */
function seg(spec: Record<number, [number, string][]>): Layer {
  const out = Array.from({ length: AV_H }, () => EMPTY.split(""));
  for (const [r, parts] of Object.entries(spec))
    for (const [c0, str] of parts) [...str].forEach((ch, i) => { if (ch !== "." && c0 + i < AV_W) out[Number(r)][c0 + i] = ch; });
  return out.map((r) => r.join(""));
}

// ------------------------------------------------------------------ body
const BODY: Record<number, string> = {
  5: ".......SSSSS",
  6: "......SSSSSS",
  7: "......SSSSSS",
  8: "......SSSSSS",
  9: "......SSSSSS",
  15: "......BBSSSS",
  16: "......sSSSSM",
  17: ".......sSSSS",
  18: "........ssSS",
  19: "..........sS",
  20: "........CCCS",
  21: ".......OCCCC",
  22: "......OOOOCC",
  23: "......OOOOOc",
  24: ".....OOOOOOO",
  25: ".....OoOOOOO",
  26: ".....OoOOOOO",
  27: ".....OoOOOOO",
  28: ".....SoOOOOO",
  29: ".....S.OOOOO",
  30: ".......oOOOO",
  31: ".........SS.",
  32: ".........SS.",
  33: ".........LL.",
  34: ".........ll.",
  35: "........FFF.",
  36: "........FFF.",
};
const EYES_OPEN = {
  10: "......SKKKSS",
  11: "......KEWESS",
  12: "......SEEESS",
  13: "......SEEESS",
  14: "......SSESSS",
};
const EYES_SHUT = {
  10: "......SSSSSS",
  11: "......SSSSSS",
  12: "......SSSSSS",
  13: "......KKKKSS",
  14: "......SSSSSS",
};
const SMILE = half({ 16: "......sSSSMW", 17: ".......sSSSM" });
const FRECKLES = half({ 15: ".......f.f..", 16: "........f..." });

// outfit overlays
const PANTS = half({ ...range(31, 34, "........PPP."), 30: ".......PPPPP" });
const CROP = half({ 28: ".....S.SSSSS", 29: ".....S.SSSSS" });
const JACKET_TIE = half({ 21: "...........T", 22: "...........T", 23: "...........T", 24: "...........T", 25: "...........T", 26: "...........T" });
const JUMPSUIT_SHOULDERS = half({ 21: ".......AA...", 22: "......AAA...", 23: ".....AA.....", 24: ".....AA....." });
// LAYYI's black top: mandarin collar, keyhole cut-out and a silver chain necklace with a drop pendant
const QIPAO = seg({
  20: [[9, "N....N"]],
  21: [[9, "N....N"]],
  22: [[10, "NnnN"]],
  23: [[11, "SS"]],
  24: [[11, "nS"], [13, "."]],
  25: [[11, "SS"]],
});

// ------------------------------------------------------------------ hair
// H hair · h shade · j shine · X / x streak A (+ dark) · Y / y streak B (+ dark)
const CAP: Record<number, string> = {
  1: "........HHHH",
  2: "......HHHHHH",
  3: ".....HHHHjHH",
  4: "....HHHjHHHH",
  5: "...HHHHHHHHH",
  6: "...HHHHHHHHH",
  7: "...HHHHHhHHH",
  8: "...HHHHH.HHH",
  9: "...HHHH..HH.",
  10: "...HHH...H..",
};

type Hair = { back: Layer; front: Layer };
const HAIR: Record<string, Hair> = {
  long: {
    back: half({ 4: "....hhhhhhhh", ...range(5, 27, "..hhhhhhhhhh"), 28: "...hhhhhhhhh", 29: "....hhhhhhhh" }),
    front: half({ ...CAP, ...range(11, 21, "...HH......."), 22: "...Hh.......", 23: "....h......." }),
  },
  bob: {
    back: half({ 4: "....hhhhhhhh", ...range(5, 17, "..hhhhhhhhhh"), 18: "...hhhhhhhhh" }),
    front: half({ ...CAP, ...range(11, 16, "..HHH......."), 17: "..HHh.......", 18: "...hh......." }),
  },

  // LAYYI — layered cut past the shoulders, wispy curtain bangs parted in the middle,
  // a vivid red outer section on her right (viewer-left) and a blonde money-piece on her left.
  wolf: {
    back: seg({
      4: [[4, "hhhhhhhhhhhhhhhh"]],
      ...Object.fromEntries(Array.from({ length: 23 }, (_, i) => [i + 5, [[2, "hhhhhhhhhhhhhhhhhhhh"]] as [number, string][]])),
      28: [[2, "hhhh"], [18, "hhhh"]],
    }),
    front: seg({
      1: [[8, "HHHHHHHH"]],
      2: [[6, "HHHHHHHHHHHH"]],
      3: [[5, "HHHjHHHHHHjHHH"]],
      4: [[4, "HHHjHHHHHHHHHHHH"]],
      5: [[3, "HHHHHHHHHHHHHYYHHH"]],
      6: [[3, "HHHHHHHHhHHHHHYYHH"]],
      7: [[2, "HHHHHHHHh"], [13, "hHHHYYYHH"]],
      8: [[2, "HHHHHHHh"], [14, "hHHYYYHH"]],
      9: [[2, "HHHH.HH"], [15, "H.HYYHH"]],
      10: [[2, "HHH"], [6, "H"], [17, "HYYHH"]],
      11: [[1, "HXHH"], [18, "hYYH"]],
      12: [[1, "XXHH"], [19, "YYH"]],
      13: [[1, "XXHh"], [19, "YYHH"]],
      14: [[1, "XXHh"], [19, "YYHH"]],
      15: [[1, "XXHh"], [19, "YyHH"]],
      16: [[1, "XxHh"], [19, "YYHH"]],
      17: [[1, "XXHh"], [19, "yYHH"]],
      18: [[1, "XXHh"], [19, "YYHH"]],
      19: [[1, "xXHh"], [19, "YYyH"]],
      20: [[0, "XXXH"], [19, "YYYH"]],
      21: [[0, "XXxH"], [19, "yYYHH"]],
      22: [[0, "XXXH"], [19, "YYYHH"]],
      23: [[0, "xXXH"], [19, "YYyH"]],
      24: [[0, "XXx"], [20, "YYH"]],
      25: [[0, "XX"], [3, "X"], [20, "yYY"]],
      26: [[1, "X"], [3, "x"], [20, "Y.Y"]],
      27: [[1, "x"], [21, "y"]],
    }),
  },

  slick: {
    back: half({ ...range(2, 13, "...hhhhhhhhh") }),
    front: half({
      1: "........HHHH",
      2: "......HHjHHH",
      3: ".....HHjHHHj",
      4: "....HHjHHHHH",
      5: "...HHHHHHHHH",
      6: "...HHHHH....",
      7: "...HHH......",
      8: "...HH.......",
      9: "...H........",
    }),
  },
  ponytail: {
    back: seg({
      ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 3, [[3, "hhhhhhhhhhhhhhhhhh"]] as [number, string][]])),
      4: [[3, "hhhhhhhhhhhhhhhhhh"], [21, "hh"]],
      5: [[3, "hhhhhhhhhhhhhhhhhh"], [21, "hhh"]],
      6: [[3, "hhhhhhhhhhhhhhhhhh"], [21, "hhh"]],
      7: [[21, "hhh"]], 8: [[21, "hhX"]], 9: [[21, "hXX"]], 10: [[21, "XX"]], 11: [[21, "X"]],
    }),
    front: half({
      1: "........HHHH",
      2: "......HHHHHH",
      3: ".....HHHjHHH",
      4: "....HHHHHHHH",
      5: "...HHHHHHHHH",
      6: "...HHHHHHHHH",
      7: "...HHHHH....",
      8: "...HHH......",
      9: "...HX.......",
      10: "...X........",
    }),
  },
  curly: {
    back: half({ ...range(2, 11, "..hhhhhhhhhh") }),
    front: half({
      0: "......HH.HH.",
      1: ".....HHHHHHH",
      2: "....HHhHHHhH",
      3: "...HHHHHjHHH",
      4: "..HHhHHHHHhH",
      5: "..HHHHhHHHHH",
      6: "..HHHHHHHhHH",
      7: "...HhHHHhHHH",
      8: "...HHHHHHHHH",
      9: "...HHH.HH.HH",
      10: "...HH.......",
      11: "...H........",
    }),
  },
  sidepart: {
    back: half({ ...range(2, 11, "...hhhhhhhhh") }),
    front: seg({
      1: [[8, "HHHHHHHH"]],
      2: [[6, "HHHHHHHHHHHH"]],
      3: [[5, "HHHHHHjHHHHHHH"]],
      4: [[4, "HHHHHHHHHHHHHHHH"]],
      5: [[3, "HHHHHHHHHHHHHHHHHH"]],
      6: [[3, "HHHHHHHHHHHHHHHHHH"]],
      7: [[3, "HHHHHHHHHHHHH"], [17, "HHHH"]],
      8: [[3, "HHHHHHHHHH"], [18, "HHH"]],
      9: [[3, "HHHHHH"], [19, "HH"]],
      10: [[3, "HH"], [19, "HH"]],
      11: [[3, "H"], [20, "H"]],
    }),
  },
};

const GLASSES_ROUND = half({ 9: ".....GGGGGG.", 10: ".....G....G.", 11: ".....G....GG", 12: ".....G....G.", 13: ".....G....G.", 14: ".....GGGGGG." });
const SUNGLASSES = half({ 10: ".....DDDDDDD", 11: ".....DgDDDSS", 12: "......DDDD..", 13: ".......DD..." });
const HOOPS = half({ 15: ".....R......", 16: ".....R......" });
const DANGLES = seg({ 14: [[5, "R"], [18, "R"]], 15: [[5, "R"], [18, "R"]], 16: [[5, "R"], [18, "R"]], 17: [[5, "n"], [18, "n"]] });

// ------------------------------------------------------------------ colour
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

type Full = AvatarConfig & { skin: string; hair: string; eyes: string; shoes: string; pet: PetKind; petName: string };
export const DEFAULT_AVATAR: Full = {
  skin: "#e2b08f",
  hair: "#2a2220",
  hairStyle: "long",
  eyes: "#1e1b26",
  top: "tee",
  topColor: "#1d1d22",
  collar: "#f3eadf",
  bottom: "skirt",
  bottomColor: "#1d1d22",
  socks: "#ffffff",
  shoes: "#2b201c",
  earrings: false,
  pet: "dove",
  petName: "Pip",
};

function palette(c: Full) {
  const top = c.topColor ?? "#1d1d22";
  const dark = (h: string) => parseInt(h.slice(1), 16) < 0x303030;
  const collar = c.top === "tee" || c.top === "crop" || c.top === "oneshoulder" ? top : c.top === "qipao" ? shade(top, 0.08) : c.collar ?? "#f3eadf";
  return {
    S: c.skin, s: shade(c.skin, -0.14), M: shade(c.skin, -0.32), f: shade(c.skin, -0.28),
    B: c.blush ?? "#ee8f98", E: c.eyes, W: "#ffffff", K: shade(c.hair, -0.25),
    H: c.hair, h: shade(c.hair, -0.22), j: shade(c.hair, dark(c.hair) ? 0.2 : 0.18),
    X: c.streak1 || c.hair, x: shade(c.streak1 || c.hair, -0.25),
    Y: c.streak2 || c.streak1 || c.hair, y: shade(c.streak2 || c.streak1 || c.hair, -0.18),
    O: top, o: shade(top, dark(top) ? 0.15 : -0.25),
    C: collar, c: shade(collar, -0.12),
    A: c.topAccent ?? "#d8343c", T: shade(top, -0.45),
    P: c.bottomColor ?? "#1d1d22",
    L: c.socks ?? "#ffffff", l: shade(c.socks ?? "#ffffff", -0.12),
    F: c.shoes,
    G: "#3a3440", D: "#141216", g: "#6f7584",
    R: "#e9e9ef", N: "#dfe3ea", n: "#a3a9b6",
  } as Record<string, string>;
}

/** Final sprite as merged runs [x, y, width, colour]. */
export function avatarRuns(cfg: AvatarConfig, blink: boolean) {
  const c = { ...DEFAULT_AVATAR, ...cfg } as Full;
  const hair = HAIR[c.hairStyle as string] ?? HAIR.long;
  const layers: Layer[] = [hair.back, half({ ...BODY, ...(blink ? EYES_SHUT : EYES_OPEN) })];
  if (c.mouth === "smile") layers.push(SMILE);
  if (c.freckles) layers.push(FRECKLES);
  if (c.top === "crop") layers.push(CROP);
  if (c.top === "jacket") layers.push(JACKET_TIE);
  if (c.top === "jumpsuit") layers.push(JUMPSUIT_SHOULDERS);
  if (c.top === "qipao") layers.push(QIPAO);
  if (c.bottom === "pants") layers.push(PANTS);
  layers.push(hair.front);
  if (c.earrings) layers.push(c.top === "qipao" ? DANGLES : HOOPS);
  if (c.glasses === "round") layers.push(GLASSES_ROUND);
  if (c.glasses === "sun") layers.push(SUNGLASSES);
  return toRuns(layers, palette(c));
}

function toRuns(layers: Layer[], pal: Record<string, string>) {
  const h = layers[0].length, w = layers[0][0].length;
  const grid: (string | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  for (const layer of layers)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = layer[y]?.[x];
        if (ch && ch !== "." && pal[ch]) grid[y][x] = pal[ch];
      }
  const runs: [number, number, number, string][] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const col = grid[y][x];
      if (!col) { x++; continue; }
      let len = 1;
      while (x + len < w && grid[y][x + len] === col) len++;
      runs.push([x, y, len, col]);
      x += len;
    }
  }
  return runs;
}

// ------------------------------------------------------------------ pets
export type PetKind = "dove" | "bunny" | "chick";
const PET_GRIDS: Record<PetKind, { label: string; flying: boolean; palette: Record<string, string>; frames: string[][] }> = {
  dove: {
    label: "Dove",
    flying: true,
    palette: { k: "#8d8fa3", W: "#ffffff", g: "#dfe2ee", e: "#1e1b26", b: "#f4a261" },
    frames: [
      ["....kkk.............", "...kWWWk............", "...kWWWWk...........", "....kWWWWk.....kkk..", ".....kWWWWk...kWWWk.", "kkk...kWWWkkkkWWeWbb", "kWWkkkWWWWWWWWWWWk..", ".kWWWWWWWWWWWWWWgk..", "..kkWWWWWWWWWWWgk...", "....kkgWWWWWWggk....", "......kkkkkkkk......", "....................", "...................."],
      ["....................", "....................", "....................", "...............kkk..", "..............kWWWk.", "kkk.......kkkkWWeWbb", "kWWkkkkkkkWWWWWWWk..", ".kWWWWWWWWWWWWWWgk..", "..kkWWWkgWWWWWWgk...", "....kWWWWkWWWggk....", "....kWWWWWkkkkk.....", ".....kWWWk..........", "......kkk..........."],
    ],
  },
  chick: {
    label: "Sprout chick",
    flying: true,
    palette: { k: "#d9a21b", Y: "#ffd84d", y: "#f5c22e", G: "#7cc47a", e: "#2b2320", b: "#f08a4b" },
    frames: [
      ["...GG..GG.....", "....GGGG......", "......G.......", "....kkkkkk....", "...kYYYYYYk...", "..kYYYYYYYYk..", "kkYYeYYYYeYYkk", "kyYYYYbbYYYYyk", ".kYYYYYYYYYYk.", "..kyYYYYYYyk..", "...kkkkkkkk...", "....bb..bb...."],
      ["...GG..GG.....", "....GGGG......", "......G.......", "....kkkkkk....", "...kYYYYYYk...", "..kYYYYYYYYk..", "..kYeYYYYeYk..", ".kyYYYbbYYYyk.", "kyYYYYYYYYYYyk", "k.kyYYYYYYyk.k", "...kkkkkkkk...", "....bb..bb...."],
    ],
  },
  bunny: {
    label: "Bunny",
    flying: false,
    palette: { k: "#c9c9d6", W: "#ffffff", P: "#f7c6cf", e: "#2b2320", p: "#f5a3b3", n: "#e97a8e" },
    frames: [
      ["..kk.kk.......", ".kPWkPWk......", ".kPWkPWk......", "kWWWWWWWk.....", "kWWWWWWWWkkkk.", "kWeWWWeWWWWWWk", "kpWWnWWpWWWWWk", "kWWWWWWWWWWWWk", ".kWWWWWWWWWWWk", "..kkkkkkkkkkk."],
      ["..kk...kk.....", ".kPWk.kPWk....", ".kPWkkPWk.....", "kWWWWWWWk.....", "kWWWWWWWWkkkk.", "kWeWWWeWWWWWWk", "kpWWnWWpWWWWWk", "kWWWWWWWWWWWWk", ".kWWWWWWWWWWWk", "..kkkkkkkkkkk."],
    ],
  },
};

export const PETS = Object.fromEntries(
  (Object.keys(PET_GRIDS) as PetKind[]).map((k) => {
    const p = PET_GRIDS[k];
    return [k, { label: p.label, flying: p.flying, w: p.frames[0][0].length, h: p.frames[0].length, frames: p.frames.map((f) => toRuns([f], p.palette)) }];
  }),
) as Record<PetKind, { label: string; flying: boolean; w: number; h: number; frames: [number, number, number, string][][] }>;
