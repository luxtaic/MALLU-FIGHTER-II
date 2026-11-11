"""
Compiles generated pixel-art stage backgrounds, portraits, and 4-pose sprite sheets
into crisp transparent PNGs and embeds them as base64 data URLs for standalone play.
"""

import base64
import json
from collections import deque
from pathlib import Path
from PIL import Image

BRAIN_DIR = Path(r"C:\Users\sreeh\.gemini\antigravity\brain\0c94f421-9bfe-43fd-86b9-179543b03ef3")
ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"

STAGES_SRC = {
    "alappuzha": "alappuzha_stage_background_clean_1794303009330.jpg",
    "fortkochi": "fortkochi_stage_1794302981720.jpg",
    "thrissur": "thrissur_stage_1794302981212.jpg",
    "munnar": "munnar_cps2_stage_1794394971344.jpg",
    "kovalam": "kovalam_cps2_stage_1794394931854.jpg",
    "kalari": "kadathanadan_kalari_stage_png_1794394975311.jpg",
}

PORTRAITS_SRC = {
    "maveli": "maveli_portrait_1794302976538.jpg",
    "george": "mundan_george_portrait_1794303040053.jpg",
    "unniyarcha": "unniyarcha_1794302983722.jpg",
    "theyyam": "theyyam_portrait_1794302987700.jpg",
    "kuttan": "kuttan_portrait_png_1794302990725.jpg",
    "digambaran": "digambaran_cps2_portrait_1794328963454.jpg",
    "minnal": "minnal_murali_cps2_portrait_v2_1794328994795.jpg",
    "kathakali": "kathakali_veeran_portrait_1794328968163.jpg",
    "nagavalli": "nagavalli_portrait_1794328970518.jpg",
    "murugan": "pulimurugan_cps2_portrait_1794328973497.jpg",
}

SPRITES_SRC = {
    "maveli": "king_mahabali_spritesheet_1794303078908.jpg",
    "george": "mundan_george_spritesheet_1794303170477.jpg",
    "unniyarcha": "unniyarcha_spritesheet_1794303176396.jpg",
    "theyyam": "agni_theyyam_sprite_sheet_1794303244489.jpg",
    "digambaran": "digambaran_cps2_spritesheet_1794328981024.jpg",
    "minnal": "minnal_murali_spritesheet_1794328979166.jpg",
    "kathakali": "kathakali_veeran_spritesheet_1794328980245.jpg",
    "nagavalli": "nagavalli_sprite_sheet_1794329048285.jpg",
    "murugan": "pulimurugan_cps2_spritesheet_1794328989726.jpg",
}

TARGET_HEIGHTS = {
    "maveli": 148,
    "george": 134,
    "unniyarcha": 124,
    "theyyam": 172,
    "kuttan": 134,
    "digambaran": 136,
    "minnal": 134,
    "kathakali": 168,
    "nagavalli": 112,
    "murugan": 138,
}


def is_bg_white(r: int, g: int, b: int, thresh: int = 222) -> bool:
    return min(r, g, b) >= thresh and (max(r, g, b) - min(r, g, b)) <= 28


def flood_remove_white(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pix = rgba.load()

    visited = [[False] * w for _ in range(h)]
    q = deque()

    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
        visited[0][x] = True
        visited[h - 1][x] = True
    for y in range(1, h - 1):
        q.append((0, y))
        q.append((w - 1, y))
        visited[y][0] = True
        visited[y][w - 1] = True

    while q:
        cx, cy = q.popleft()
        r, g, b, _ = pix[cx, cy]
        if not is_bg_white(r, g, b, 222):
            continue
        pix[cx, cy] = (0, 0, 0, 0)
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                visited[ny][nx] = True
                q.append((nx, ny))

    # Defringe 1px JPEG anti-aliased light halo adjacent to transparent background
    to_clear = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            if min(r, g, b) >= 165 and (max(r, g, b) - min(r, g, b)) <= 28:
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if pix[nx, ny][3] == 0:
                        to_clear.append((x, y))
                        break
    for x, y in to_clear:
        pix[x, y] = (0, 0, 0, 0)

    return rgba


def split_four_poses(rgba: Image.Image) -> list[Image.Image]:
    """Extracts 4 isolated sprite poses using 2D connected component labeling."""
    w, h = rgba.size
    pix = rgba.load()
    vis = bytearray(w * h)
    comps = []

    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if vis[idx] or pix[x, y][3] == 0:
                continue
            q = deque([(x, y)])
            vis[idx] = 1
            pts = []
            minx = maxx = x
            miny = maxy = y
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                if cx < minx:
                    minx = cx
                if cx > maxx:
                    maxx = cx
                if cy < miny:
                    miny = cy
                if cy > maxy:
                    maxy = cy
                for dy in (-2, -1, 0, 1, 2):
                    ny = cy + dy
                    if 0 <= ny < h:
                        for dx in (-2, -1, 0, 1, 2):
                            nx = cx + dx
                            if 0 <= nx < w:
                                nidx = ny * w + nx
                                if not vis[nidx] and pix[nx, ny][3] > 0:
                                    vis[nidx] = 1
                                    q.append((nx, ny))
            if len(pts) > 2500:
                comps.append((minx, miny, maxx, maxy, pts))

    if len(comps) > 4:
        comps = sorted(comps, key=lambda c: len(c[4]), reverse=True)[:4]
    comps.sort(key=lambda c: c[0])

    crops = []
    for minx, miny, maxx, maxy, pts in comps:
        cw = maxx - minx + 1
        ch = maxy - miny + 1
        out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        opix = out.load()
        for px, py in pts:
            opix[px - minx, py - miny] = pix[px, py]
        crops.append(out)
    return crops


def reskin_george_to_kuttan(pose_img: Image.Image) -> Image.Image:
    """Transforms Mundan George pose into Auto Kuttan (khaki shirt, red checkered thorthu, blue checkered lungi)."""
    out = pose_img.copy().convert("RGBA")
    w, h = out.size
    pix = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            # Never touch dark outlines or warm brown skin tones
            if max(r, g, b) < 75:
                continue
            is_skin = (r - g >= 38 and b < 125) or (r > 125 and g > 70 and b < 95 and r - b >= 65 and r - g >= 25)
            if is_skin:
                continue

            lum = (r + g + b) / (3.0 * 255.0)
            is_cool_cloth = (b >= r - 8 and min(r, g, b) >= 105)
            is_red_stripe = (y < int(h * 0.52) and r >= 135 and g <= 75 and b <= 75)
            is_mundu_gold = (int(h * 0.36) <= y <= int(h * 0.74) and r >= 150 and g >= 128 and r - g <= 42)

            if y < int(h * 0.45):
                if is_red_stripe:
                    check = ((x // 3) + (y // 3)) % 2 == 0
                    pix[x, y] = (225, 42, 42, a) if check else (248, 250, 252, a)
                elif is_cool_cloth:
                    pix[x, y] = (
                        min(255, int(218 * lum)),
                        min(255, int(190 * lum)),
                        min(255, int(122 * lum)),
                        a,
                    )
            elif is_mundu_gold or is_cool_cloth:
                check = ((x // 4) + (y // 4)) % 2 == 0
                grid_line = (x % 4 == 0 or y % 4 == 0)
                base = ((147, 197, 253) if check else (30, 64, 175)) if grid_line else ((59, 130, 246) if check else (29, 78, 216))
                scale = max(0.45, min(1.12, lum * 1.15))
                pix[x, y] = (
                    min(255, int(base[0] * scale)),
                    min(255, int(base[1] * scale)),
                    min(255, int(base[2] * scale)),
                    a,
                )
    return out


def encode_png(path: Path) -> str:
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def process_all():
    (ASSETS / "stages").mkdir(parents=True, exist_ok=True)
    (ASSETS / "portraits").mkdir(parents=True, exist_ok=True)
    (ASSETS / "sprites").mkdir(parents=True, exist_ok=True)

    manifest = {"stages": {}, "crowdStrips": {}, "portraits": {}, "sprites": {}}

    for sid, fname in STAGES_SRC.items():
        img = Image.open(BRAIN_DIR / fname).convert("RGB")
        out_img = img.resize((640, 360), Image.Resampling.LANCZOS)
        out_path = ASSETS / "stages" / f"{sid}.png"
        out_img.save(out_path, "PNG", optimize=True)
        manifest["stages"][sid] = encode_png(out_path)
        print(f"Stage {sid}: {out_path.name}")

    for strip_name in (
        "alappuzha_crowd",
        "fortkochi_crowd_l",
        "fortkochi_crowd_r",
        "thrissur_crowd_l",
        "thrissur_crowd_r",
    ):
        strip_path = ASSETS / "stages" / f"{strip_name}.png"
        if strip_path.exists():
            manifest["crowdStrips"][strip_name] = encode_png(strip_path)
            print(f"Crowd strip {strip_name}: {strip_path.name}")

    for cid, fname in PORTRAITS_SRC.items():
        img = Image.open(BRAIN_DIR / fname).convert("RGB")
        out_img = img.resize((160, 160), Image.Resampling.LANCZOS)
        out_path = ASSETS / "portraits" / f"{cid}.png"
        out_img.save(out_path, "PNG", optimize=True)
        manifest["portraits"][cid] = encode_png(out_path)
        print(f"Portrait {cid}: {out_path.name}")

    george_scaled_poses = []

    for cid, fname in SPRITES_SRC.items():
        raw = Image.open(BRAIN_DIR / fname)
        rgba = flood_remove_white(raw)
        poses = split_four_poses(rgba)
        print(f"Sprite {cid}: extracted {len(poses)} poses")
        idle_h = poses[0].height if poses else 100
        scale = TARGET_HEIGHTS[cid] / max(1, idle_h)
        manifest["sprites"][cid] = []
        for idx, pose in enumerate(poses):
            nw = max(1, int(round(pose.width * scale)))
            nh = max(1, int(round(pose.height * scale)))
            scaled = pose.resize((nw, nh), Image.Resampling.LANCZOS)
            out_path = ASSETS / "sprites" / f"{cid}_{idx}.png"
            scaled.save(out_path, "PNG", optimize=True)
            manifest["sprites"][cid].append({
                "w": nw,
                "h": nh,
                "dataUrl": encode_png(out_path),
            })
            if cid == "george":
                george_scaled_poses.append(scaled)

    manifest["sprites"]["kuttan"] = []
    for idx, g_pose in enumerate(george_scaled_poses):
        k_pose = reskin_george_to_kuttan(g_pose)
        out_path = ASSETS / "sprites" / f"kuttan_{idx}.png"
        k_pose.save(out_path, "PNG", optimize=True)
        manifest["sprites"]["kuttan"].append({
            "w": k_pose.width,
            "h": k_pose.height,
            "dataUrl": encode_png(out_path),
        })
    print(f"Sprite kuttan: reskinned {len(george_scaled_poses)} poses")

    js_path = ROOT / "src" / "assets_data.js"
    js_path.write_text(
        "// Auto-generated embedded pixel-art stage, portrait, and sprite assets\n"
        f"export const ASSETS_DATA = {json.dumps(manifest)};\n",
        encoding="utf-8",
    )
    print(f"Wrote {js_path.name} ({js_path.stat().st_size} bytes)")


if __name__ == "__main__":
    process_all()
