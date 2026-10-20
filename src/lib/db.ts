import postgres from "postgres";
import { BRAND } from "./brand";

declare global {
  // eslint-disable-next-line no-var
  var __spaceSql: ReturnType<typeof postgres> | undefined;
}

function make() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, { max: 5, prepare: false, onnotice: () => {} });
}

export const sql = globalThis.__spaceSql ?? (globalThis.__spaceSql = make());

export type Access = "master" | "admin" | "member";

export type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_label: string;
  access: Access;
  avatar: AvatarConfig;
  photo: string | null;
  theme: "light" | "dark";
  created_at: string;
};

export type AvatarConfig = {
  skin?: string;
  hair?: string;
  streak1?: string;
  streak2?: string;
  hairStyle?: "wolf" | "long" | "bob" | "slick" | "ponytail" | "curly" | "sidepart";
  eyes?: string;
  top?: "tee" | "crop" | "jacket" | "jumpsuit" | "oneshoulder" | "qipao";
  topColor?: string;
  topAccent?: string;
  collar?: string;
  bottom?: "skirt" | "pants";
  bottomColor?: string;
  socks?: string;
  shoes?: string;
  glasses?: "none" | "round" | "sun";
  freckles?: boolean;
  earrings?: boolean;
  mouth?: "neutral" | "smile";
  blush?: string;
  pet?: "dove" | "bunny" | "chick";
  petName?: string;
};

export type Settings = {
  artist_name: string;
  accent: string;
  logo: string | null;
  photo: string | null;
  timezone: string;
};

export async function getSettings(): Promise<Settings | null> {
  const rows = await sql<Settings[]>`select artist_name, accent, logo, photo, timezone from settings where id = 1`;
  const s = rows[0];
  if (!s) return null;
  return { ...s, logo: s.logo ?? BRAND.logo };
}

export const memberCols = sql`id, name, email, phone, role_label, access, avatar, photo, theme, created_at`;
