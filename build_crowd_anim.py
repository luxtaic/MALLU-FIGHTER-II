from pathlib import Path
from PIL import Image

ROOT = Path(r"c:\Users\sreeh\OneDrive\เอกสาร\spidey\kerala_fighter")
SCRATCH = Path(r"C:\Users\sreeh\.gemini\antigravity\brain\0c94f421-9bfe-43fd-86b9-179543b03ef3\scratch")
OUT_STAGES = ROOT / "assets" / "stages"


def shear_region_x(src_img, out_img, x0, y0, x1, y1, pivot_y, dx_top, mask_fn, clean_bg_fn):
    """Pure horizontal row-shear around pivot_y (0px at pivot_y -> dx_top at y0). Zero vertical gaps."""
    spx = src_img.load()
    opx = out_img.load()
    w, _ = out_img.size
    height = max(1.0, float(pivot_y - y0))

    for y in range(y0, y1):
        for x in range(x0, x1):
            if mask_fn(x, y, spx[x, y]):
                opx[x, y] = clean_bg_fn(x, y)

    for y in range(y0, y1):
        t = max(0.0, min(1.0, (pivot_y - y) / height))
        shift = int(round(dx_top * t))
        for x in range(x0, x1):
            if mask_fn(x, y, spx[x, y]):
                nx = x + shift
                if 0 <= nx < w:
                    opx[nx, y] = spx[x, y]


def shift_patch(src_img, out_img, box, dx, dy, mask_fn, erase_bg_fn=None):
    """Copy crisp sub-sprite patch shifted by integer (dx, dy)."""
    x0, y0, x1, y1 = box
    spx = src_img.load()
    opx = out_img.load()
    w, h = out_img.size
    if erase_bg_fn:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if mask_fn(x, y, spx[x, y]):
                    opx[x, y] = erase_bg_fn(x, y)
    for y in range(y0, y1):
        ny = y + dy
        if not (0 <= ny < h):
            continue
        for x in range(x0, x1):
            nx = x + dx
            if not (0 <= nx < w):
                continue
            c = spx[x, y]
            if mask_fn(x, y, c):
                opx[nx, ny] = c


def save_verify_grid(frames, out_name):
    w, h = frames[0].size
    sheet = Image.new("RGB", (w * 4, h * 4))
    for i, fr in enumerate(frames):
        sheet.paste(fr.resize((w * 2, h * 2), Image.NEAREST), ((i % 2) * w * 2, (i // 2) * h * 2))
    sheet.save(SCRATCH / out_name)


# ==============================================================================
# 1. ALAPPUZHA HOUSEBOAT SPECTATORS (x=286..442, y=126..200)
# ==============================================================================
def build_alappuzha_crowd():
    base = Image.open(OUT_STAGES / "alappuzha.png").convert("RGB")
    bx0, by0, bx1, by1 = 286, 126, 442, 200
    bay = base.crop((bx0, by0, bx1, by1))
    w, h = bay.size
    bpx = bay.load()

    def is_sky_or_sea(rgb):
        r, g, b = rgb
        return (
            (b > 175 and b - r >= 22)
            or (b > 135 and g > 130 and r < 72 and b - r >= 55)
            or (r > 200 and g > 215 and b > 230)
        )

    def clean_right_sky(x, y):
        # Strictly right side sky/water behind red-shirt arm (`x=440..441` is always pure sky!)
        for cx in range(440 - bx0, w):
            if is_sky_or_sea(bpx[cx, y]):
                return bpx[cx, y]
        for dist in range(1, 20):
            for cx in (407 - bx0 - dist, 439 - bx0):
                if 0 <= cx < w and is_sky_or_sea(bpx[cx, y]):
                    return bpx[cx, y]
        return bpx[w - 1, y]

    def clean_mid_sky(x, y):
        # Mid bay sky/water cleanly sampled at `350` or `313` (never picking wood post!)
        for cx in (350 - bx0, 314 - bx0, 396 - bx0):
            if 0 <= cx < w and is_sky_or_sea(bpx[cx, y]):
                return bpx[cx, y]
        return bpx[w - 1, y]

    frame_specs = [
        (-2, -1,  0,  0),
        ( 0,  0,  1,  1),
        ( 2,  1,  1,  1),
        ( 0,  0,  0,  0),
    ]
    frames = []
    for (r_wave, b_wave, c_fist, u_fist) in frame_specs:
        fr = bay.copy()

        # 1. Red-shirt raised arm + white thorthu cleanly waving over pure open sky
        def red_arm_mask(x, y, rgb):
            ax, ay = bx0 + x, by0 + y
            if not (411 <= ax <= 440 and 132 <= ay <= 152):
                return False
            r, g, b = rgb
            if b > 195 and b - r >= 28 and not (415 <= ax <= 432 and 136 <= ay <= 145):
                return False
            if b > 175 and r < 155 and b - r >= 35:
                return False
            return True
        if r_wave != 0:
            shear_region_x(
                bay, fr, 411 - bx0, 132 - by0, 440 - bx0, 152 - by0,
                pivot_y=153 - by0, dx_top=r_wave,
                mask_fn=red_arm_mask, clean_bg_fn=clean_right_sky
            )

        # 2. Blue-shirt right forearm & towel (`abs x=316..331, y=139..153`, preserve entire finger/wrist silhouette except pure wood `(48,28,17)`)
        if b_wave != 0:
            def blue_rarm_mask(x, y, rgb):
                ax, ay = bx0 + x, by0 + y
                r, g, b = rgb
                is_dark_cabin = (r < 58 and g < 38 and b < 26)
                return not is_dark_cabin and not (ay >= 146 and is_sky_or_sea(rgb))
            def blue_r_bg(x, y):
                ax, ay = bx0 + x, by0 + y
                return clean_mid_sky(x, y) if (ay >= 147 and ax <= 317) else (48, 28, 17)
            shear_region_x(
                bay, fr, 316 - bx0, 139 - by0, 331 - bx0, 153 - by0,
                pivot_y=154 - by0, dx_top=b_wave,
                mask_fn=blue_rarm_mask, clean_bg_fn=blue_r_bg
            )

        # 3. Blue-shirt left raised cheering forearm (`abs x=346..357, y=139..152`, keep solid silhouette)
        if b_wave != 0:
            def blue_larm_mask(x, y, rgb):
                ax, ay = bx0 + x, by0 + y
                r, g, b = rgb
                is_dark_cabin = (r < 58 and g < 38 and b < 26)
                return not is_dark_cabin and not (ay >= 145 and is_sky_or_sea(rgb))
            def blue_l_bg(x, y):
                return clean_mid_sky(x, y) if (by0 + y) >= 147 else (48, 28, 17)
            shear_region_x(
                bay, fr, 346 - bx0, 139 - by0, 357 - bx0, 152 - by0,
                pivot_y=153 - by0, dx_top=-b_wave,
                mask_fn=blue_larm_mask, clean_bg_fn=blue_l_bg
            )

        # 4. Uncle's outer cheering fist tip (`abs x=316..319, y=164..173`, completely outside green cuff!)
        if u_fist != 0:
            shift_patch(
                bay, fr, (316 - bx0, 164 - by0, 320 - bx0, 174 - by0),
                dx=u_fist, dy=0, mask_fn=lambda x, y, rgb: not is_sky_or_sea(rgb),
                erase_bg_fn=clean_mid_sky
            )

        # 5. Kasavu Chechi's raised cheering fingers (`abs x=376..381, y=156..165` against dark beam edge, no horizontal smear!)
        if c_fist != 0:
            shift_patch(
                bay, fr, (376 - bx0, 156 - by0, 381 - bx0, 165 - by0),
                dx=0, dy=-c_fist,
                mask_fn=lambda x, y, rgb: rgb[0] > 95 and not is_sky_or_sea(rgb),
                erase_bg_fn=lambda x, y: bpx[375 - bx0, y]
            )

        frames.append(fr)

    strip = Image.new("RGB", (w, h * 4))
    for i, fr in enumerate(frames):
        strip.paste(fr, (0, i * h))
    strip.save(OUT_STAGES / "alappuzha_crowd.png", optimize=True)
    save_verify_grid(frames, "verify_alap_v3.png")
    print("Alappuzha clean:", (bx0, by0, w, h))


# ==============================================================================
# 2. FORT KOCHI CHAYAKKADA
# ==============================================================================
def build_fortkochi_crowd():
    base = Image.open(OUT_STAGES / "fortkochi.png").convert("RGB")

    # Region L: Left Uncle subtle chest/head nod + gently rocking cup (`1px` sip lift without touching moustache!)
    lx0, ly0, lx1, ly1 = 0, 144, 98, 224
    lbay = base.crop((lx0, ly0, lx1, ly1))
    lbpx = lbay.load()

    l_frames = []
    l_specs = [(0, 0, 0), (-1, 0, 1), (-1, -1, 1), (0, 0, 0)]
    for (c_dy, c_dx, g_sway) in l_specs:
        fr = lbay.copy()
        if c_dy != 0 or c_dx != 0:
            def cup_arm_mask(x, y, rgb):
                ax, ay = lx0 + x, ly0 + y
                if not (28 <= ax <= 44 and 177 <= ay <= 192):
                    return False
                r, g, b = rgb
                return (r > 135 and g > 130 and b > 125) or (r > 105 and g > 60 and b < 95)
            def erase_cup_bg(x, y):
                ax = lx0 + x
                return lbpx[min(lbay.width - 1, 45 - lx0), y] if ax >= 40 else lbpx[22 - lx0, y]
            shift_patch(
                lbay, fr, (28 - lx0, 177 - ly0, 44 - lx0, 192 - ly0),
                dx=c_dx, dy=c_dy, mask_fn=cup_arm_mask, erase_bg_fn=erase_cup_bg
            )

        # Green-shirt customer subtle shoulder turn starting at x=66 (`only over right-side back/head -> zero waiter khaki seam!`)
        if g_sway != 0:
            def green_mask(x, y, rgb):
                ax, ay = lx0 + x, ly0 + y
                return 66 <= ax <= 95 and 146 <= ay <= 204 and not (ax >= 88 and sum(rgb) < 130)
            def clean_green_side(x, y):
                ax = lx0 + x
                return lbpx[max(0, 64 - lx0), y] if ax < 76 else lbpx[min(lbay.width - 1, 96 - lx0), y]
            shear_region_x(
                lbay, fr, 66 - lx0, 146 - ly0, 95 - lx0, 204 - ly0,
                pivot_y=205 - ly0, dx_top=g_sway, mask_fn=green_mask, clean_bg_fn=clean_green_side
            )
        l_frames.append(fr)

    l_strip = Image.new("RGB", (lbay.width, lbay.height * 4))
    for i, fr in enumerate(l_frames):
        l_strip.paste(fr, (0, i * lbay.height))
    l_strip.save(OUT_STAGES / "fortkochi_crowd_l.png", optimize=True)
    save_verify_grid(l_frames, "verify_kochi_l.png")

    # Region R: Chayakkaran pouring upper metal mug (`x=236..258, y=114..134`) + beach customers leaning smoothly over ocean!
    rx0, ry0, rx1, ry1 = 214, 112, 418, 205
    rbay = base.crop((rx0, ry0, rx1, ry1))
    rbpx = rbay.load()

    def is_sunset_bg(rgb, x, y):
        r, g, b = rgb
        ay = ry0 + y
        if ay < 170:
            return r > 175 and g > 65 and b < 135
        return (r > 85 and b > 70 and abs(r - b) < 80)

    r_frames = []
    r_specs = [(0, 0, 0, 0), (1, -1, 1, 0), (1, -1, 1, 0), (0, 0, 0, 0)]
    for (uc_dx, uc_dy, c_sway, b_sway) in r_specs:
        fr = rbay.copy()
        fpx = fr.load()

        # Strictly the upper metal tumbler (`abs x=239..257, y=114..129`) tilting cleanly above his wrist (`0` sleeve line!)
        if uc_dx != 0 or uc_dy != 0:
            def mug_mask(x, y, rgb):
                return rgb[0] > 110 and rgb[1] > 110 and rgb[2] > 105
            shift_patch(
                rbay, fr, (239 - rx0, 114 - ry0, 257 - rx0, 129 - ry0),
                dx=uc_dx, dy=uc_dy, mask_fn=mug_mask,
                erase_bg_fn=lambda x, y: (42, 24, 16)
            )

        # White-shirt counter customer back-shoulder lean (`314..344, 170..203` -> zero face/sunset outline specks!)
        if c_sway != 0:
            def cust1_mask(x, y, rgb):
                ax, ay = rx0 + x, ry0 + y
                return 314 <= ax <= 344 and 172 <= ay <= 203 and not is_sunset_bg(rgb, x, y)
            def clean_c1_side(x, y):
                return rbpx[min(rbay.width - 1, 345 - rx0), y]
            shear_region_x(
                rbay, fr, 314 - rx0, 172 - ry0, 344 - rx0, 203 - ry0,
                pivot_y=204 - ry0, dx_top=c_sway, mask_fn=cust1_mask, clean_bg_fn=clean_c1_side
            )

        # Blue-shirt beach man back shoulder lean (`392..415, 168..204` -> zero forehead specks!)
        if b_sway != 0:
            def cust2_mask(x, y, rgb):
                ax, ay = rx0 + x, ry0 + y
                return 392 <= ax <= 415 and 168 <= ay <= 204 and not is_sunset_bg(rgb, x, y)
            def clean_c2_side(x, y):
                return rbpx[min(rbay.width - 1, 417 - rx0), y]
            shear_region_x(
                rbay, fr, 392 - rx0, 168 - ry0, 415 - rx0, 204 - ry0,
                pivot_y=205 - ry0, dx_top=b_sway, mask_fn=cust2_mask, clean_bg_fn=clean_c2_side
            )

        # Wooden post locked cleanly
        for y in range(rbay.height):
            for x in range(347 - rx0, 374 - rx0):
                fpx[x, y] = rbpx[x, y]

        r_frames.append(fr)

    r_strip = Image.new("RGB", (rbay.width, rbay.height * 4))
    for i, fr in enumerate(r_frames):
        r_strip.paste(fr, (0, i * rbay.height))
    r_strip.save(OUT_STAGES / "fortkochi_crowd_r.png", optimize=True)
    save_verify_grid(r_frames, "verify_kochi_r.png")
    print("Fort Kochi clean!")


# ==============================================================================
# 3. THRISSUR POORAM
# ==============================================================================
def build_thrissur_crowd():
    base = Image.open(OUT_STAGES / "thrissur.png").convert("RGB")

    lx0, ly0, lx1, ly1 = 50, 176, 268, 268
    lbay = base.crop((lx0, ly0, lx1, ly1))
    lbpx = lbay.load()

    rx0, ry0, rx1, ry1 = 390, 176, 580, 268
    rbay = base.crop((rx0, ry0, rx1, ry1))
    rbpx = rbay.load()

    l_frames = []
    l_specs = [
        (-2,  0, -2, -2,  1),
        ( 0,  1,  0,  1, -2),
        ( 3,  2,  2,  2,  1),
        ( 0,  0,  0, -1, -2),
    ]
    for (fan_wave, cym_dx, trunk_w, l1_dy, l2_dy) in l_specs:
        fr = lbay.copy()
        fpx = fr.load()

        # 1. Left cheering fan forearm wave (`y=178..210`, sample exact background pixel `(88, y)`)
        if fan_wave != 0:
            shear_region_x(
                lbay, fr, 72 - lx0, 178 - ly0, 87 - lx0, 210 - ly0,
                pivot_y=212 - ly0, dx_top=fan_wave,
                mask_fn=lambda x, y, rgb: sum(rgb) > 95,
                clean_bg_fn=lambda x, y: lbpx[89 - lx0, y]
            )

        # 2. Left Ilathalam gold cymbal subtle strike (`108..122, 206..230`, clashes cleanly +1 inward cleanly on strike!)
        if cym_dx != 0:
            shift_patch(
                lbay, fr, (108 - lx0, 206 - ly0, 122 - lx0, 230 - ly0),
                dx=1, dy=0,
                mask_fn=lambda x, y, rgb: sum(rgb) > 105,
                erase_bg_fn=lambda x, y: (38, 30, 38) if lx0 + x <= 112 else lbpx[min(lbay.width - 1, 123 - lx0), y]
            )

        # 3. Left elephant lower trunk sway (`x=134..148, y=190..260`, clean gray background sampled directly right of trunk at `150, y`)
        if trunk_w != 0:
            for y in range(190 - ly0, 260 - ly0):
                t = max(0.0, min(1.0, (y - (190 - ly0)) / 70.0))
                sh = int(round(trunk_w * t * t))
                if sh == 0:
                    continue
                for x in range(133 - lx0, 149 - lx0):
                    r, g, b = lbpx[x, y]
                    if not (r > 180 and g > 180 and b > 165):
                        fpx[x, y] = lbpx[150 - lx0, y]
                for x in range(133 - lx0, 149 - lx0):
                    r, g, b = lbpx[x, y]
                    if not (r > 180 and g > 180 and b > 165) and 0 <= x + sh < fr.width:
                        fpx[x + sh, y] = (r, g, b)

        # 4. Left Chenda drummer arms & sticks striking drumheads
        shift_patch(lbay, fr, (187 - lx0, 220 - ly0, 217 - lx0, 240 - ly0), dx=0, dy=l1_dy, mask_fn=lambda x, y, rgb: sum(rgb) > 95)
        shift_patch(lbay, fr, (222 - lx0, 222 - ly0, 252 - lx0, 242 - ly0), dx=0, dy=l2_dy, mask_fn=lambda x, y, rgb: sum(rgb) > 95)
        l_frames.append(fr)

    l_strip = Image.new("RGB", (lbay.width, lbay.height * 4))
    for i, fr in enumerate(l_frames):
        l_strip.paste(fr, (0, i * lbay.height))
    l_strip.save(OUT_STAGES / "thrissur_crowd_l.png", optimize=True)
    save_verify_grid(l_frames, "verify_thri_l.png")

    r_frames = []
    r_specs = [(2, 1, -2, 0), (0, -2, 1, 1), (-2, -1, 2, 2), (0, 2, -1, 0)]
    for (trunk_w, r1_dy, r2_dy, cym_dx) in r_specs:
        fr = rbay.copy()
        fpx = fr.load()

        # 1. Right elephant trunk cleanly BETWEEN ivory tusks (`x=504..517, y=200..260`, background sampled at `519, y`!)
        if trunk_w != 0:
            for y in range(200 - ry0, 260 - ry0):
                t = max(0.0, min(1.0, (y - (200 - ry0)) / 60.0))
                sh = int(round(trunk_w * t * t))
                if sh == 0:
                    continue
                for x in range(504 - rx0, 517 - rx0):
                    r, g, b = rbpx[x, y]
                    if not (r > 180 and g > 180 and b > 165):
                        fpx[x, y] = rbpx[min(rbay.width - 1, 518 - rx0), y]
                for x in range(504 - rx0, 517 - rx0):
                    r, g, b = rbpx[x, y]
                    if not (r > 180 and g > 180 and b > 165) and 0 <= x + sh < fr.width:
                        fpx[x + sh, y] = (r, g, b)

        # 2. Right Cymbal Player brass clash (`538..552, 206..230`, shifts cleanly +1 toward chest hand!)
        if cym_dx != 0:
            shift_patch(
                rbay, fr, (538 - rx0, 206 - ry0, 552 - rx0, 230 - ry0),
                dx=1, dy=0,
                mask_fn=lambda x, y, rgb: sum(rgb) > 105,
                erase_bg_fn=lambda x, y: (38, 30, 38)
            )

        # 3. Drummers R1 (`394..424`) & R2 (`424..454`)
        shift_patch(rbay, fr, (394 - rx0, 219 - ry0, 424 - rx0, 238 - ry0), dx=0, dy=r1_dy, mask_fn=lambda x, y, rgb: sum(rgb) > 95)
        shift_patch(rbay, fr, (424 - rx0, 222 - ry0, 454 - rx0, 241 - ry0), dx=0, dy=r2_dy, mask_fn=lambda x, y, rgb: sum(rgb) > 95)
        r_frames.append(fr)

    r_strip = Image.new("RGB", (rbay.width, rbay.height * 4))
    for i, fr in enumerate(r_frames):
        r_strip.paste(fr, (0, i * rbay.height))
    r_strip.save(OUT_STAGES / "thrissur_crowd_r.png", optimize=True)
    save_verify_grid(r_frames, "verify_thri_r.png")
    print("Thrissur clean!")


if __name__ == "__main__":
    build_alappuzha_crowd()
    build_fortkochi_crowd()
    build_thrissur_crowd()
