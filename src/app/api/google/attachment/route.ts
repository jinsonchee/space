import { NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { getAttachment } from "@/lib/gmail";
import { PREVIEWABLE } from "@/lib/preview";

export const dynamic = "force-dynamic";

/** Downloads an email attachment from the person's own Gmail (streamed through, never stored). */
export async function GET(req: Request) {
  const me = await currentMember();
  if (!me) return new NextResponse("Not logged in", { status: 401 });
  const p = new URL(req.url).searchParams;
  const data = await getAttachment(me.id, p.get("m") ?? "", p.get("a") ?? "");
  if (!data) return new NextResponse("Attachment not found", { status: 404 });
  const name = (p.get("name") ?? "attachment").replace(/[\r\n"]/g, "");
  // Preview (inline) only for types a browser shows safely — images and PDFs. Everything else
  // (including HTML and SVG, which could run code on this site) is always downloaded.
  const type = p.get("t") ?? "";
  const inline = p.get("view") === "1" && PREVIEWABLE.has(type);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": inline ? type : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
