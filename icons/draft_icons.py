from PIL import Image, ImageDraw

def icon_a_flask(size=1024):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        ratio = y / size
        r = int(0 + ratio * 0)
        g = int(85 + ratio * (201 - 85))
        b = int(212 + ratio * (183 - 212))
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    cx, cy = size // 2, size // 2
    s = size * 0.55
    neck_w = s * 0.22
    neck_h = s * 0.35
    neck_top = cy - s * 0.35
    draw.polygon([
        (cx - neck_w/2, neck_top + neck_h),
        (cx + neck_w/2, neck_top + neck_h),
        (cx + neck_w/3, neck_top),
        (cx - neck_w/3, neck_top),
    ], fill=(255,255,255,240))
    draw.rounded_rectangle(
        [cx - neck_w/2 - 4, neck_top - 12, cx + neck_w/2 + 4, neck_top + 8],
        radius=6, fill=(255,255,255,240)
    )
    body_r = s * 0.38
    draw.ellipse(
        [cx - body_r, cy - body_r*0.3, cx + body_r, cy + body_r*1.3],
        fill=(255,255,255,240)
    )
    liquid_r = body_r * 0.85
    draw.ellipse(
        [cx - liquid_r, cy + body_r*0.1, cx + liquid_r, cy + body_r*1.15],
        fill=(0, 201, 183, 180)
    )
    draw.ellipse(
        [cx - body_r*0.6, cy - body_r*0.1, cx - body_r*0.1, cy + body_r*0.6],
        fill=(255,255,255,60)
    )
    return img

def icon_b_test_tubes(size=1024):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        ratio = y / size
        r = int(0 + ratio * 56)
        g = int(201 + ratio * (170 - 201))
        b = int(183 + ratio * (109 - 183))
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    cx, cy = size // 2, size // 2
    s = size * 0.5
    bar_y1 = cy - s * 0.15
    bar_y2 = cy + s * 0.25
    bar_h = s * 0.08
    draw.rounded_rectangle(
        [cx - s*0.55, bar_y1, cx + s*0.55, bar_y1 + bar_h],
        radius=4, fill=(255,255,255,230)
    )
    draw.rounded_rectangle(
        [cx - s*0.55, bar_y2, cx + s*0.55, bar_y2 + bar_h],
        radius=4, fill=(255,255,255,230)
    )
    tube_w = s * 0.12
    offsets = [-0.28, 0, 0.28]
    colors = [(0,201,183,200), (56,170,109,200), (0,133,255,200)]
    for i, ox in enumerate(offsets):
        tx = cx + s * ox
        draw.rounded_rectangle(
            [tx - tube_w/2, cy - s*0.35, tx + tube_w/2, cy + s*0.2],
            radius=int(tube_w//3), fill=(255,255,255,230)
        )
        draw.rounded_rectangle(
            [tx - tube_w/2 + 4, cy - s*0.05, tx + tube_w/2 - 4, cy + s*0.15],
            radius=int(tube_w//4), fill=colors[i]
        )
    return img

def icon_c_bottle(size=1024):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, size, size], radius=size//5, fill=(0, 85, 212))
    cx, cy = size // 2, size // 2
    s = size * 0.45
    body_w = s * 0.9
    body_h = s * 1.0
    draw.rounded_rectangle(
        [cx - body_w/2, cy - body_h*0.3, cx + body_w/2, cy + body_h*0.6],
        radius=20, fill=(255,255,255,240)
    )
    cap_w = s * 0.5
    cap_h = s * 0.2
    draw.rounded_rectangle(
        [cx - cap_w/2, cy - body_h*0.3 - cap_h, cx + cap_w/2, cy - body_h*0.3],
        radius=8, fill=(255,255,255,220)
    )
    label_w = s * 0.6
    label_h = s * 0.35
    draw.rounded_rectangle(
        [cx - label_w/2, cy - label_h*0.2, cx + label_w/2, cy + label_h*0.6],
        radius=8, fill=(240,245,255,255)
    )
    line_w = label_w * 0.7
    line_h = 6
    for i in range(3):
        ly = cy + label_h * (0.05 + i * 0.18)
        draw.rounded_rectangle(
            [cx - line_w/2, ly, cx + line_w/2, ly + line_h],
            radius=3, fill=(180,190,210,255)
        )
    draw.ellipse(
        [cx - body_w*0.35, cy - body_h*0.1, cx - body_w*0.15, cy + body_h*0.3],
        fill=(255,255,255,80)
    )
    return img

icon_a = icon_a_flask(1024)
icon_a.save('/Users/yy/Desktop/kimi/reagent-inventory-app/icons/draft_a_flask.png')
icon_a.resize((256,256)).save('/Users/yy/Desktop/kimi/reagent-inventory-app/icons/draft_a_flask_preview.png')

icon_b = icon_b_test_tubes(1024)
icon_b.save('/Users/yy/Desktop/kimi/reagent-inventory-app/icons/draft_b_tubes.png')
icon_b.resize((256,256)).save('/Users/yy/Desktop/kimi/reagent-inventory-app/icons/draft_b_tubes_preview.png')

icon_c = icon_c_bottle(1024)
icon_c.save('/Users/yy/Desktop/kimi/reagent-inventory-app/icons/draft_c_bottle.png')
icon_c.resize((256,256)).save('/Users/yy/Desktop/kimi/reagent-inventory-app/icons/draft_c_bottle_preview.png')

print("Done")
