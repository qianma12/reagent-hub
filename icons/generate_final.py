from PIL import Image, ImageDraw

def icon_test_tubes(size=1024):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    
    # 圆角背景 - 青色到绿色渐变（活力感）
    radius = size // 5
    for y in range(size):
        ratio = y / size
        r = int(0 + ratio * 56)
        g = int(201 + ratio * (170 - 201))
        b = int(183 + ratio * (109 - 183))
        for x in range(size):
            # 圆角裁剪
            if (x < radius and y < radius and (x-radius)**2 + (y-radius)**2 > radius**2) or \
               (x > size-radius and y < radius and (x-(size-radius))**2 + (y-radius)**2 > radius**2) or \
               (x < radius and y > size-radius and (x-radius)**2 + (y-(size-radius))**2 > radius**2) or \
               (x > size-radius and y > size-radius and (x-(size-radius))**2 + (y-(size-radius))**2 > radius**2):
                continue
            img.putpixel((x, y), (r, g, b, 255))
    
    cx, cy = size // 2, size // 2
    s = size * 0.5
    
    # 试管架横杆
    bar_y1 = cy - s * 0.15
    bar_y2 = cy + s * 0.25
    bar_h = max(4, int(s * 0.08))
    
    # 上横杆
    draw.rounded_rectangle(
        [int(cx - s*0.55), int(bar_y1), int(cx + s*0.55), int(bar_y1 + bar_h)],
        radius=bar_h//2, fill=(255,255,255,245)
    )
    # 下横杆
    draw.rounded_rectangle(
        [int(cx - s*0.55), int(bar_y2), int(cx + s*0.55), int(bar_y2 + bar_h)],
        radius=bar_h//2, fill=(255,255,255,245)
    )
    
    # 三支试管
    tube_w = max(8, int(s * 0.14))
    offsets = [-0.28, 0, 0.28]
    colors = [(0,201,183,220), (56,170,109,220), (0,133,255,220)]
    for i, ox in enumerate(offsets):
        tx = int(cx + s * ox)
        # 试管外框（圆角矩形）
        tube_top = int(cy - s*0.35)
        tube_bottom = int(cy + s*0.22)
        draw.rounded_rectangle(
            [tx - tube_w//2, tube_top, tx + tube_w//2, tube_bottom],
            radius=tube_w//2, fill=(255,255,255,245)
        )
        # 液体
        liquid_top = int(cy - s*0.02)
        liquid_bottom = int(cy + s*0.18)
        draw.rounded_rectangle(
            [tx - tube_w//2 + 3, liquid_top, tx + tube_w//2 - 3, liquid_bottom],
            radius=max(2, (tube_w-6)//2), fill=colors[i]
        )
        # 试管口高光
        draw.ellipse(
            [tx - tube_w//4, tube_top + 2, tx + tube_w//4, tube_top + tube_w//2],
            fill=(255,255,255,100)
        )
    
    return img

# 生成主图标
main = icon_test_tubes(1024)
main.save('/Users/yy/Desktop/kimi/reagent-inventory-app/src-tauri/icons/128x128@2x.png')

# 各尺寸
main.resize((32, 32), Image.LANCZOS).save('/Users/yy/Desktop/kimi/reagent-inventory-app/src-tauri/icons/32x32.png')
main.resize((128, 128), Image.LANCZOS).save('/Users/yy/Desktop/kimi/reagent-inventory-app/src-tauri/icons/128x128.png')

# 256x256 for .icns base
s256 = main.resize((256, 256), Image.LANCZOS)
s256.save('/Users/yy/Desktop/kimi/reagent-inventory-app/src-tauri/icons/256x256.png')

# 512x512 for .icns
s512 = main.resize((512, 512), Image.LANCZOS)
s512.save('/Users/yy/Desktop/kimi/reagent-inventory-app/src-tauri/icons/512x512.png')

# 1024x1024 for .icns
main.save('/Users/yy/Desktop/kimi/reagent-inventory-app/src-tauri/icons/1024x1024.png')

# 生成 .icns (macOS 图标集)
import struct
import io

def make_icns(images_dict):
    """images_dict: {size: PIL Image}"""
    icns_data = b'icns'
    
    # 需要使用的类型和尺寸映射
    icon_types = {
        16: b'icp4',
        32: b'icp5', 
        64: b'icp6',
        128: b'ic07',
        256: b'ic08',
        512: b'ic09',
        1024: b'ic10',
    }
    
    entries = []
    for size, img in images_dict.items():
        if size in icon_types:
            png_data = io.BytesIO()
            img.resize((size, size), Image.LANCZOS).save(png_data, format='PNG')
            png_bytes = png_data.getvalue()
            icon_type = icon_types[size]
            entry_len = 8 + len(png_bytes)
            entries.append(struct.pack('>4sI', icon_type, entry_len) + png_bytes)
    
    # 计算总长度
    total_len = 8 + sum(len(e) for e in entries)
    header = struct.pack('>4sI', b'icns', total_len)
    
    return header + b''.join(entries)

# 构建 icns
icns_images = {
    16: main,
    32: main,
    64: main,
    128: main,
    256: s256,
    512: s512,
    1024: main,
}

icns_data = make_icns(icns_images)
with open('/Users/yy/Desktop/kimi/reagent-inventory-app/src-tauri/icons/icon.icns', 'wb') as f:
    f.write(icns_data)

# 生成 .ico (Windows 图标集)
from PIL import Image
ico_sizes = [(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)]
ico_images = [main.resize(s, Image.LANCZOS) for s in ico_sizes]
ico_images[0].save(
    '/Users/yy/Desktop/kimi/reagent-inventory-app/src-tauri/icons/icon.ico',
    format='ICO',
    sizes=ico_sizes
)

print("Icons generated:")
print("  32x32.png")
print("  128x128.png")
print("  128x128@2x.png")
print("  icon.icns")
print("  icon.ico")
print("Done!")
