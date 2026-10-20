import type { AvatarConfig } from "./db";

/**
 * Hand-tuned characters for LAYYI's Space, drawn from each person's real photos.
 * `photo` lives in /public/team. Picking a preset when adding someone fills in their
 * name, role, character and photo in one go.
 */
export type Preset = { key: string; name: string; role: string; photo: string; avatar: AvatarConfig };

export const PRESETS: Preset[] = [
  {
    key: "layyi",
    name: "LAYYI",
    role: "Artist",
    photo: "/team/layyi.jpg",
    avatar: {
      // "love" era: layered cut past the shoulders, curtain bangs, red outer section + blonde money-piece,
      // black mandarin-collar top with keyhole, silver chain necklace, dangling earrings
      skin: "#ecc3a4",
      hair: "#2a201f",
      streak1: "#e0294a",
      streak2: "#e9c486",
      hairStyle: "wolf",
      eyes: "#24181a",
      top: "qipao",
      topColor: "#1b1a1f",
      bottom: "skirt",
      bottomColor: "#1b1a1f",
      socks: "#ffffff",
      shoes: "#2b201c",
      earrings: true,
      blush: "#ee8f98",
      pet: "dove",
      petName: "Coo",
    },
  },
  {
    key: "gabe",
    name: "Gabe",
    role: "Creative Director",
    photo: "/team/gabe.jpg",
    avatar: {
      skin: "#eac2a2",
      hair: "#141214",
      hairStyle: "slick",
      eyes: "#1e1b26",
      glasses: "sun",
      top: "tee",
      topColor: "#18181c",
      bottom: "pants",
      bottomColor: "#1e1e23",
      shoes: "#0f0e11",
      earrings: true,
      blush: "#e9a58c",
    },
  },
  {
    key: "carissa",
    name: "Carissa",
    role: "Social Media Assistant",
    photo: "/team/carissa.jpg",
    avatar: {
      skin: "#e1b08b",
      hair: "#1f1a1d",
      streak1: "#d7a2c8",
      hairStyle: "ponytail",
      eyes: "#1e1b26",
      top: "crop",
      topColor: "#18181c",
      bottom: "pants",
      bottomColor: "#26262c",
      shoes: "#ececf1",
      mouth: "smile",
      blush: "#ec9a86",
    },
  },
  {
    key: "nathan",
    name: "Nathan",
    role: "Videographer",
    photo: "/team/nathan.jpg",
    avatar: {
      skin: "#c8956f",
      hair: "#151214",
      hairStyle: "curly",
      eyes: "#1e1b26",
      glasses: "round",
      top: "jacket",
      topColor: "#22252c",
      collar: "#a9c1db",
      bottom: "pants",
      bottomColor: "#2a2c33",
      shoes: "#16161a",
      blush: "#d98f74",
    },
  },
  {
    key: "shien",
    name: "Shien",
    role: "Designer",
    photo: "/team/shien.jpg",
    avatar: {
      skin: "#efc9a8",
      hair: "#151316",
      hairStyle: "sidepart",
      eyes: "#1e1b26",
      glasses: "round",
      top: "jumpsuit",
      topColor: "#2c45a8",
      topAccent: "#d8343c",
      collar: "#f4f4f6",
      bottom: "pants",
      bottomColor: "#2c45a8",
      shoes: "#16161a",
      blush: "#eba48c",
    },
  },
];

export function presetFor(nameOrKey: string) {
  const k = nameOrKey.trim().toLowerCase();
  return PRESETS.find((p) => p.key === k || p.name.toLowerCase() === k) ?? null;
}
