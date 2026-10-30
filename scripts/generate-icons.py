#!/usr/bin/env python3
"""
生成 Electron Starter 跨平台桌面端与 Web 图标套件：
- resources/icons/icon.svg (矢量源文件)
- resources/icons/icon-1024.png (1024x1024 超清母图)
- resources/icons/icon.png (512x512 跨平台通用标准图)
- resources/icons/icon.ico (Windows 多分辨率复合图标：16, 24, 32, 48, 64, 128, 256)
- resources/icons/icon.icns (macOS 官方 Retina 图标包)
- public/favicon.ico (Web / 启动画面小图标)
- public/favicon.png (Web 页面标签页图标)
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
    """生成高精度的现代科技风格 SVG 矢量源文件"""
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- 背景圆角渐变 -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="45%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>

    <!-- 边框内高光渐变 -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05"/>
    </linearGradient>

    <!-- 轨道渐变 1 (0 deg) -->
    <linearGradient id="orbitGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>

    <!-- 轨道渐变 2 (60 deg) -->
    <linearGradient id="orbitGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#2dd4bf"/>
    </linearGradient>

    <!-- 轨道渐变 3 (-60 deg) -->
    <linearGradient id="orbitGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>

    <!-- 中心能量核心光晕 -->
    <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="35%" stop-color="#67e8f9"/>
      <stop offset="70%" stop-color="#3b82f6" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0"/>
    </radialGradient>

    <!-- 底板柔和阴影 -->
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#020617" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- 背景 Squircle 底板 -->
  <rect x="102" y="102" width="820" height="820" rx="185" fill="url(#bgGrad)" filter="url(#dropShadow)"/>

  <!-- 内边缘细腻高光描边 -->
  <rect x="103" y="103" width="818" height="818" rx="184" fill="none" stroke="url(#borderGrad)" stroke-width="4"/>

  <!-- 背景装饰微光球 -->
  <circle cx="512" cy="512" r="280" fill="url(#coreGlow)" opacity="0.4"/>

  <!-- 3 条 Electron 原子特征轨道 -->
  <g transform="translate(512, 512)">
    <!-- 轨道 1: 0 度 -->
    <ellipse rx="290" ry="110" fill="none" stroke="url(#orbitGrad1)" stroke-width="18" stroke-linecap="round"/>
    <circle cx="280" cy="0" r="16" fill="#ffffff" filter="drop-shadow(0 0 8px #38bdf8)"/>

    <!-- 轨道 2: 60 度 -->
    <g transform="rotate(60)">
      <ellipse rx="290" ry="110" fill="none" stroke="url(#orbitGrad2)" stroke-width="18" stroke-linecap="round"/>
      <circle cx="-280" cy="0" r="16" fill="#ffffff" filter="drop-shadow(0 0 8px #2dd4bf)"/>
    </g>

    <!-- 轨道 3: -60 度 -->
    <g transform="rotate(-60)">
      <ellipse rx="290" ry="110" fill="none" stroke="url(#orbitGrad3)" stroke-width="18" stroke-linecap="round"/>
      <circle cx="0" cy="110" r="16" fill="#ffffff" filter="drop-shadow(0 0 8px #a78bfa)"/>
    </g>

    <!-- 中心极速启明星晶核 (Nova Sparkle) -->
    <path d="M 0 -85 Q 0 0 85 0 Q 0 0 0 85 Q 0 0 -85 0 Q 0 0 0 -85 Z" fill="#ffffff" filter="drop-shadow(0 0 16px #38bdf8)"/>
    <!-- 中心高光点 -->
    <circle cx="0" cy="0" r="20" fill="#ffffff"/>
  </g>
</svg>
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_content.strip() + "\n")
    print(f"✓ 生成矢量文件: {output_path}")


def render_master_image() -> Image.Image:
    """
    通过 2x 超采样 (2048x2048 -> 1024x1024) 绘制极致平滑、抗锯齿的图标母图
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
    s_draw.rounded_rectangle(s_box, radius=radius, fill=(2, 6, 23, 160))
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(int(28 * scale)))
    img.alpha_composite(shadow_img)

    # 2. 绘制圆角矩形主体渐变
    bg_mask = Image.new("L", (dim, dim), 0)
    bg_mask_draw = ImageDraw.Draw(bg_mask)
    bg_box = [margin, margin, margin + box_size, margin + box_size]
    bg_mask_draw.rounded_rectangle(bg_box, radius=radius, fill=255)

    grad_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grad_layer)

    # 从顶部深科技蓝到中央宝蓝再到底部深夜色渐变
    c_top = (30, 58, 138)       # #1e3a8a
    c_mid = (37, 99, 235)       # #2563eb
    c_bot = (15, 23, 42)        # #0f172a

    for y in range(margin, margin + box_size):
        factor = (y - margin) / float(box_size)
        if factor < 0.45:
            f = factor / 0.45
            r = int(c_top[0] + (c_mid[0] - c_top[0]) * f)
            g = int(c_top[1] + (c_mid[1] - c_top[1]) * f)
            b = int(c_top[2] + (c_mid[2] - c_top[2]) * f)
        else:
            f = (factor - 0.45) / 0.55
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
    b_draw.rounded_rectangle(b_box, radius=radius, outline=(255, 255, 255, 70), width=b_width)
    img.alpha_composite(border_layer)

    # 4. 绘制中心微光环境氛围
    glow_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    center = (512 * scale, 512 * scale)
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_r = int(280 * scale)
    glow_box = [center[0] - glow_r, center[1] - glow_r, center[0] + glow_r, center[1] + glow_r]
    glow_draw.ellipse(glow_box, fill=(56, 189, 248, 45))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(int(40 * scale)))
    img.alpha_composite(glow_layer)

    # 5. 绘制三组倾斜轨道及高光点
    orbits_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))

    def draw_orbit(angle_deg: float, color: tuple, dot_angle_rad: float):
        temp = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
        t_draw = ImageDraw.Draw(temp)
        rx = int(290 * scale)
        ry = int(112 * scale)
        o_box = [center[0] - rx, center[1] - ry, center[0] + rx, center[1] + ry]
        o_width = int(18 * scale)

        t_draw.ellipse(o_box, outline=color, width=o_width)

        # 轨道上的电子节点
        dx = int(center[0] + rx * math.cos(dot_angle_rad))
        dy = int(center[1] + ry * math.sin(dot_angle_rad))
        dot_r = int(18 * scale)
        t_draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=(255, 255, 255, 255))

        # 节点光晕
        glow_dot_r = int(32 * scale)
        t_draw.ellipse([dx - glow_dot_r, dy - glow_dot_r, dx + glow_dot_r, dy + glow_dot_r], fill=(color[0], color[1], color[2], 90))

        # 旋转到位
        rotated = temp.rotate(angle_deg, resample=Image.Resampling.BICUBIC, center=center)
        orbits_layer.alpha_composite(rotated)

    # 轨道 1: 0 度
    draw_orbit(0, (56, 189, 248, 240), dot_angle_rad=0.0)
    # 轨道 2: 60 度
    draw_orbit(60, (45, 212, 191, 240), dot_angle_rad=math.pi)
    # 轨道 3: -60 度
    draw_orbit(-60, (167, 139, 250, 240), dot_angle_rad=math.pi / 2)

    img.alpha_composite(orbits_layer)

    # 6. 绘制中心璀璨星芒晶核 (Nova Sparkle)
    sparkle_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    sp_draw = ImageDraw.Draw(sparkle_layer)

    cx, cy = center
    r_long = 90 * scale

    poly_pts = []
    steps = 72
    for i in range(steps):
        theta = i * 2 * math.pi / steps
        cost = math.cos(theta)
        sint = math.sin(theta)
        val = abs(cost) ** 0.55 + abs(sint) ** 0.55
        if val > 0:
            rad = r_long / (val ** 1.8)
        else:
            rad = 20 * scale
        poly_pts.append((cx + rad * cost, cy + rad * sint))

    sp_draw.polygon(poly_pts, fill=(255, 255, 255, 255))

    sp_glow = sparkle_layer.filter(ImageFilter.GaussianBlur(int(14 * scale)))
    img.alpha_composite(sp_glow)
    img.alpha_composite(sparkle_layer)

    # 中心纯白高光球
    center_dot_r = int(22 * scale)
    c_draw = ImageDraw.Draw(img)
    c_draw.ellipse([cx - center_dot_r, cy - center_dot_r, cx + center_dot_r, cy + center_dot_r], fill=(255, 255, 255, 255))

    # 超采样下采样到标准 1024x1024
    final_1024 = img.resize((1024, 1024), resample=Image.Resampling.LANCZOS)
    return final_1024


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


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    print("1. 生成 SVG 矢量源文件...")
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

    print("\n所有图标生成完成！")


if __name__ == "__main__":
    main()
