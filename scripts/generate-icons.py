#!/usr/bin/env python3
"""
生成 Electron Starter 跨平台桌面端与 Web 图标套件 (Electron + Vue 现代融合版)：
- resources/icons/icon.svg (矢量源文件)
- resources/icons/icon-1024.png (1024x1024 超清母图)
- resources/icons/icon.png (512x512 跨平台通用标准图)
- resources/icons/icon.ico (Windows 多分辨率复合图标：16, 24, 32, 48, 64, 128, 256)
- resources/icons/icon.icns (macOS 官方 Retina 图标包)
- public/favicon.ico (Web / 启动画面小图标)
- public/favicon.png (Web 页面标签页图标)
- resources/icons/trayTemplate.png & @2x (macOS 状态栏模版)
- resources/icons/tray.ico & tray.png (Windows / Linux 托盘)
"""

import math
import os
import shutil
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(PROJECT_ROOT, "resources", "icons")
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")


def generate_svg(output_path: str):
    """生成高精度 Electron + Vue 现代融合科技风格 SVG 矢量源文件"""
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- 背景圆角渐变: 深空极光墨蓝紫 -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1329"/>
      <stop offset="50%" stop-color="#111e38"/>
      <stop offset="100%" stop-color="#050a16"/>
    </linearGradient>

    <!-- 边框内高光渐变 -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
    </linearGradient>

    <!-- Vue 外翼渐变 (Emerald 翡翠绿) -->
    <linearGradient id="vueOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#42d392"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>

    <!-- Vue 内翼渐变 (科技深青蓝) -->
    <linearGradient id="vueInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="60%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>

    <!-- Electron 量子流光环绕轨道渐变 -->
    <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>

    <!-- 中心极光能量光晕 -->
    <radialGradient id="auroraGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#42d392" stop-opacity="0.35"/>
      <stop offset="45%" stop-color="#38bdf8" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#0b1329" stop-opacity="0"/>
    </radialGradient>

    <!-- 柔和阴影 -->
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#020617" flood-opacity="0.55"/>
    </filter>
  </defs>

  <!-- 背景 Squircle 底板 -->
  <rect x="102" y="102" width="820" height="820" rx="185" fill="url(#bgGrad)" filter="url(#dropShadow)"/>

  <!-- 内边缘细腻高光描边 -->
  <rect x="103" y="103" width="818" height="818" rx="184" fill="none" stroke="url(#borderGrad)" stroke-width="4"/>

  <!-- 背景极光环境光球 -->
  <circle cx="512" cy="512" r="320" fill="url(#auroraGlow)"/>

  <!-- 1. Electron 穿透式环形轨道 (后半段) -->
  <g transform="translate(512, 512) rotate(-32)">
    <ellipse rx="360" ry="140" fill="none" stroke="url(#orbitGrad)" stroke-width="16" stroke-dasharray="1400" stroke-dashoffset="0" opacity="0.6"/>
  </g>

  <!-- 2. Vue 双层棱镜晶核结构 -->
  <g transform="translate(512, 512)">
    <!-- Vue 外翼 V 多边形 -->
    <polygon points="0,260 -260,-220 -150,-220 0,60 150,-220 260,-220" fill="url(#vueOuterGrad)" filter="drop-shadow(0 12px 24px rgba(16, 185, 129, 0.35))"/>

    <!-- Vue 内翼 V 多边形 (科技蓝晶核) -->
    <polygon points="0,170 -160,-220 -80,-220 0,-70 80,-220 160,-220" fill="url(#vueInnerGrad)"/>

    <!-- 核心能量高光星芒 -->
    <circle cx="0" cy="-60" r="14" fill="#ffffff" filter="drop-shadow(0 0 10px #38bdf8)"/>
  </g>

  <!-- 3. Electron 穿透式环形轨道 (前半段带高光粒子) -->
  <g transform="translate(512, 512) rotate(-32)">
    <!-- 环绕轨道主线 -->
    <ellipse rx="360" ry="140" fill="none" stroke="url(#orbitGrad)" stroke-width="18" stroke-linecap="round"/>
    <!-- 能量量子粒子 1 (右侧) -->
    <circle cx="340" cy="45" r="18" fill="#ffffff" filter="drop-shadow(0 0 12px #38bdf8)"/>
    <circle cx="340" cy="45" r="8" fill="#38bdf8"/>
    <!-- 能量量子粒子 2 (左上) -->
    <circle cx="-350" cy="-35" r="14" fill="#ffffff" filter="drop-shadow(0 0 10px #42d392)"/>
  </g>
</svg>
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_content.strip() + "\n")
    print(f"✓ 生成矢量文件: {output_path}")


def render_master_image() -> Image.Image:
    """
    通过 2x 超采样 (2048x2048 -> 1024x1024) 绘制极致平滑、抗锯齿的 Electron + Vue 融合图标母图
    """
    scale = 2
    dim = 1024 * scale  # 2048
    img = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))

    # 1. 绘制底板阴影
    shadow_img = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_img)
    margin = int(102 * scale)
    box_size = int(820 * scale)
    radius = int(185 * scale)
    s_offset_y = int(24 * scale)

    s_box = [margin, margin + s_offset_y, margin + box_size, margin + s_offset_y + box_size]
    s_draw.rounded_rectangle(s_box, radius=radius, fill=(2, 6, 23, 170))
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(int(30 * scale)))
    img.alpha_composite(shadow_img)

    # 2. 绘制圆角矩形主体渐变
    bg_mask = Image.new("L", (dim, dim), 0)
    bg_mask_draw = ImageDraw.Draw(bg_mask)
    bg_box = [margin, margin, margin + box_size, margin + box_size]
    bg_mask_draw.rounded_rectangle(bg_box, radius=radius, fill=255)

    grad_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grad_layer)

    # 深空极光墨蓝紫底板渐变
    c_top = (11, 19, 41)       # #0b1329
    c_mid = (17, 30, 56)       # #111e38
    c_bot = (5, 10, 22)        # #050a16

    for y in range(margin, margin + box_size):
        factor = (y - margin) / float(box_size)
        if factor < 0.5:
            f = factor / 0.5
            r = int(c_top[0] + (c_mid[0] - c_top[0]) * f)
            g = int(c_top[1] + (c_mid[1] - c_top[1]) * f)
            b = int(c_top[2] + (c_mid[2] - c_top[2]) * f)
        else:
            f = (factor - 0.5) / 0.5
            r = int(c_mid[0] + (c_bot[0] - c_mid[0]) * f)
            g = int(c_mid[1] + (c_bot[1] - c_mid[1]) * f)
            b = int(c_mid[2] + (c_bot[2] - c_mid[2]) * f)
        g_draw.line([(margin, y), (margin + box_size, y)], fill=(r, g, b, 255))

    img.paste(grad_layer, (0, 0), bg_mask)

    # 3. 绘制内边缘高光细描边
    border_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(border_layer)
    b_width = int(3 * scale)
    b_box = [margin + b_width // 2, margin + b_width // 2, margin + box_size - b_width // 2, margin + box_size - b_width // 2]
    b_draw.rounded_rectangle(b_box, radius=radius, outline=(255, 255, 255, 60), width=b_width)
    img.alpha_composite(border_layer)

    # 4. 绘制中心微光环境氛围
    glow_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    center = (512 * scale, 512 * scale)
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_r = int(300 * scale)
    glow_box = [center[0] - glow_r, center[1] - glow_r, center[0] + glow_r, center[1] + glow_r]
    glow_draw.ellipse(glow_box, fill=(66, 211, 146, 50))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(int(45 * scale)))
    img.alpha_composite(glow_layer)

    cx, cy = center

    # 5. 绘制三维单倾斜 Electron 量子环绕轨道
    orbit_temp = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    o_draw = ImageDraw.Draw(orbit_temp)
    rx = int(360 * scale)
    ry = int(140 * scale)
    o_box = [cx - rx, cy - ry, cx + rx, cy + ry]
    o_width = int(18 * scale)

    # 绘制轨道外光晕与主轨道线
    o_draw.ellipse(o_box, outline=(56, 189, 248, 230), width=o_width)

    # 轨道上的量子粒子 1
    p1_rad = 0.15
    dx1 = int(cx + rx * math.cos(p1_rad))
    dy1 = int(cy + ry * math.sin(p1_rad))
    p1_r = int(20 * scale)
    o_draw.ellipse([dx1 - p1_r, dy1 - p1_r, dx1 + p1_r, dy1 + p1_r], fill=(255, 255, 255, 255))
    o_draw.ellipse([dx1 - int(32 * scale), dy1 - int(32 * scale), dx1 + int(32 * scale), dy1 + int(32 * scale)], fill=(56, 189, 248, 80))

    # 轨道上的量子粒子 2
    p2_rad = math.pi + 0.2
    dx2 = int(cx + rx * math.cos(p2_rad))
    dy2 = int(cy + ry * math.sin(p2_rad))
    p2_r = int(15 * scale)
    o_draw.ellipse([dx2 - p2_r, dy2 - p2_r, dx2 + p2_r, dy2 + p2_r], fill=(255, 255, 255, 255))

    # 旋转轨道 -32 度
    rotated_orbit = orbit_temp.rotate(-32, resample=Image.Resampling.BICUBIC, center=center)
    img.alpha_composite(rotated_orbit)

    # 6. 绘制 Vue 现代双层棱镜晶核
    vue_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vue_layer)

    # 外层 Vue 晶体多边形 (Emerald 翡翠绿)
    poly_outer = [
        (cx, cy + int(260 * scale)),
        (cx - int(260 * scale), cy - int(220 * scale)),
        (cx - int(150 * scale), cy - int(220 * scale)),
        (cx, cy + int(60 * scale)),
        (cx + int(150 * scale), cy - int(220 * scale)),
        (cx + int(260 * scale), cy - int(220 * scale)),
    ]
    v_draw.polygon(poly_outer, fill=(66, 211, 146, 255))

    # 内层 Vue 晶体多边形 (科技深青蓝)
    poly_inner = [
        (cx, cy + int(170 * scale)),
        (cx - int(160 * scale), cy - int(220 * scale)),
        (cx - int(80 * scale), cy - int(220 * scale)),
        (cx, cy - int(70 * scale)),
        (cx + int(80 * scale), cy - int(220 * scale)),
        (cx + int(160 * scale), cy - int(220 * scale)),
    ]
    v_draw.polygon(poly_inner, fill=(56, 189, 248, 255))

    # 核心高光亮星
    star_r = int(16 * scale)
    v_draw.ellipse([cx - star_r, cy - int(60 * scale) - star_r, cx + star_r, cy - int(60 * scale) + star_r], fill=(255, 255, 255, 255))

    # 外层阴影
    vue_shadow = vue_layer.filter(ImageFilter.GaussianBlur(int(12 * scale)))
    img.alpha_composite(vue_shadow)
    img.alpha_composite(vue_layer)

    # 超采样下采样到标准 1024x1024
    return img.resize((1024, 1024), resample=Image.Resampling.LANCZOS)


def generate_ico(base_img: Image.Image, output_path: str):
    """生成 Windows 专用多尺寸复合 .ico 文件"""
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    base_img.save(output_path, format="ICO", sizes=sizes)
    print(f"✓ 生成 Windows 图标: {output_path} (多尺寸包含: {sizes})")


def generate_icns(base_img: Image.Image, output_path: str):
    """
    通过 macOS 官方 iconutil 工具生成标准的 .icns 图标包
    """
    iconset_dir = os.path.join(ICONS_DIR, "icon.iconset")
    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
    os.makedirs(iconset_dir, exist_ok=True)

    specs = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]

    for filename, size in specs:
        target_path = os.path.join(iconset_dir, filename)
        resized = base_img.resize((size, size), resample=Image.Resampling.LANCZOS)
        resized.save(target_path, "PNG")

    try:
        subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", output_path], check=True)
        print(f"✓ 生成 macOS 图标: {output_path}")
    finally:
        if os.path.exists(iconset_dir):
            shutil.rmtree(iconset_dir)


def render_tray_symbol(dim: int, is_template: bool = False) -> Image.Image:
    """
    渲染适用于 macOS 状态栏或 Windows/Linux 托盘的极简 Vue-Electron 融合符号：
    - Template 模式：纯黑加 Alpha 透明通道，用于系统菜单栏自适应高亮。
    - 彩色模式：经典 Vue 绿 (#42d392) 加科技蓝量子光环。
    """
    scale = 4
    canvas_dim = dim * scale
    img = Image.new("RGBA", (canvas_dim, canvas_dim), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = canvas_dim // 2, canvas_dim // 2

    if is_template:
        fill_color = (0, 0, 0, 255)
        orbit_color = (0, 0, 0, 220)
    else:
        fill_color = (66, 211, 146, 255)
        orbit_color = (56, 189, 248, 255)

    # 1. 简练的 Vue V 字棱镜多边形
    h_span = int(canvas_dim * 0.40)
    top_y = cy - int(canvas_dim * 0.32)
    bot_y = cy + int(canvas_dim * 0.35)
    thickness = int(canvas_dim * 0.14)

    poly = [
        (cx, bot_y),
        (cx - h_span, top_y),
        (cx - h_span + thickness, top_y),
        (cx, bot_y - int(thickness * 1.5)),
        (cx + h_span - thickness, top_y),
        (cx + h_span, top_y),
    ]
    d.polygon(poly, fill=fill_color)

    # 2. 环绕贯穿的单斜量子轨道与光斑
    temp_orbit = Image.new("RGBA", (canvas_dim, canvas_dim), (0, 0, 0, 0))
    od = ImageDraw.Draw(temp_orbit)
    or_x = int(canvas_dim * 0.44)
    or_y = int(canvas_dim * 0.16)
    od.ellipse([cx - or_x, cy - or_y, cx + or_x, cy + or_y], outline=orbit_color, width=max(int(scale * 1.2), int(canvas_dim * 0.08)))
    # 量子粒子点
    dot_r = max(int(scale * 1.4), int(canvas_dim * 0.09))
    od.ellipse([cx + or_x - dot_r, cy - dot_r, cx + or_x + dot_r, cy + dot_r], fill=fill_color)

    rotated_orbit = temp_orbit.rotate(-28, resample=Image.Resampling.BICUBIC, center=(cx, cy))
    img.alpha_composite(rotated_orbit)

    # Template 模式强制 RGB 为纯黑
    if is_template:
        _, _, _, a = img.split()
        black = Image.new("L", img.size, 0)
        img = Image.merge("RGBA", (black, black, black, a))

    return img.resize((dim, dim), resample=Image.Resampling.LANCZOS)


def generate_tray_icons(output_dir: str):
    """
    生成托盘所需全套规范文件：
    - macOS: trayTemplate.png (16x16), trayTemplate@2x.png (32x32)
    - Windows: tray.ico (包含 16x16, 24x24, 32x32 多尺寸复合图标)
    - 通用/Linux: tray.png (16x16), tray@2x.png (32x32)
    """
    # 1. macOS 模版图标
    template_16 = render_tray_symbol(16, is_template=True)
    template_32 = render_tray_symbol(32, is_template=True)
    template_16_path = os.path.join(output_dir, "trayTemplate.png")
    template_32_path = os.path.join(output_dir, "trayTemplate@2x.png")
    template_16.save(template_16_path, "PNG")
    template_32.save(template_32_path, "PNG")
    print(f"✓ 生成 macOS 托盘模版图标: {template_16_path} (16x16) & {template_32_path} (32x32)")

    # 2. Windows 专用多尺寸复合托盘 ico
    color_16 = render_tray_symbol(16, is_template=False)
    color_24 = render_tray_symbol(24, is_template=False)
    color_32 = render_tray_symbol(32, is_template=False)
    win_ico_path = os.path.join(output_dir, "tray.ico")
    color_32.save(win_ico_path, format="ICO", sizes=[(16, 16), (24, 24), (32, 32)])
    print(f"✓ 生成 Windows 专用托盘图标: {win_ico_path} (多尺寸包含: 16, 24, 32)")

    # 3. 跨平台/Linux 通用彩色托盘图标
    color_16_path = os.path.join(output_dir, "tray.png")
    color_32_path = os.path.join(output_dir, "tray@2x.png")
    color_16.save(color_16_path, "PNG")
    color_32.save(color_32_path, "PNG")
    print(f"✓ 生成通用托盘彩色图标: {color_16_path} (16x16) & {color_32_path} (32x32)")


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    print("1. 生成 SVG 矢量源文件 (Electron + Vue 融合创意)...")
    svg_path = os.path.join(ICONS_DIR, "icon.svg")
    generate_svg(svg_path)

    print("2. 渲染 1024x1024 超清母图...")
    img_1024 = render_master_image()
    master_png_path = os.path.join(ICONS_DIR, "icon-1024.png")
    img_1024.save(master_png_path, "PNG")
    print(f"✓ 生成母图 PNG: {master_png_path}")

    print("3. 生成 512x512 跨平台通用标准图...")
    img_512 = img_1024.resize((512, 512), resample=Image.Resampling.LANCZOS)
    png_path = os.path.join(ICONS_DIR, "icon.png")
    img_512.save(png_path, "PNG")
    print(f"✓ 生成标准 PNG: {png_path}")

    print("4. 生成 Windows 复合 .ico 文件...")
    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    generate_ico(img_1024, ico_path)

    print("5. 生成 macOS 原生 .icns 文件...")
    icns_path = os.path.join(ICONS_DIR, "icon.icns")
    generate_icns(img_1024, icns_path)

    print("6. 生成 Web / 启动画面 Favicon...")
    favicon_ico_path = os.path.join(PUBLIC_DIR, "favicon.ico")
    img_1024.save(favicon_ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"✓ 生成 public/favicon.ico: {favicon_ico_path}")

    favicon_png_path = os.path.join(PUBLIC_DIR, "favicon.png")
    img_64 = img_1024.resize((64, 64), resample=Image.Resampling.LANCZOS)
    img_64.save(favicon_png_path, "PNG")
    print(f"✓ 生成 public/favicon.png: {favicon_png_path}")

    print("7. 生成桌面托盘图标 (macOS Template & 通用彩色)...")
    generate_tray_icons(ICONS_DIR)

    print("\n所有 Electron + Vue 图标生成完成！")


if __name__ == "__main__":
    main()
