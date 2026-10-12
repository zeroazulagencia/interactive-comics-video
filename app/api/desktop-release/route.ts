import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REPO = process.env.DESKTOP_REPO ?? "zeroazulagencia/interactive-comics-video";

type GithubAsset = { name: string; size: number; browser_download_url: string };

export type DesktopRelease = {
  version: string;
  publishedAt: string;
  notesUrl: string;
  downloads: { arch: "arm64" | "x64"; url: string; sizeMb: number }[];
};

// GET /api/desktop-release — última versión de la app para Mac publicada en GitHub Releases.
export async function GET() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 600 },
    });
    if (res.status === 404) return NextResponse.json({ release: null });
    if (!res.ok) throw new Error(`GitHub respondió ${res.status}`);
    const data = await res.json();
    const downloads: DesktopRelease["downloads"] = [];
    for (const a of (data.assets ?? []) as GithubAsset[]) {
      if (!a.name.endsWith(".dmg")) continue;
      const arch = /aarch64|arm64/.test(a.name) ? "arm64" : /x64|x86_64/.test(a.name) ? "x64" : null;
      if (arch) downloads.push({ arch, url: a.browser_download_url, sizeMb: Math.round(a.size / 1e6) });
    }
    const release: DesktopRelease = {
      version: String(data.tag_name ?? "").replace(/^v/, ""),
      publishedAt: data.published_at,
      notesUrl: data.html_url,
      downloads,
    };
    return NextResponse.json({ release: downloads.length ? release : null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo consultar" }, { status: 502 });
  }
}
