from PIL import Image, ImageDraw, ImageFilter
import math

SOURCE = 'assets/images/icon_source.png'

def remove_bg(img, tolerance=40):
    """Remove background using flood-fill from corners."""
    img = img.convert('RGBA')
    w, h = img.size
    data = img.load()

    # Sample background color from corners
    corners = [data[0,0], data[w-1,0], data[0,h-1], data[w-1,h-1]]
    # Use average of corners as reference BG color
    bg_r = sum(c[0] for c in corners) // 4
    bg_g = sum(c[1] for c in corners) // 4
    bg_b = sum(c[2] for c in corners) // 4

    # Mark all pixels close to BG color as transparent
    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            dist = math.sqrt((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2)
            if dist < tolerance:
                data[x, y] = (r, g, b, 0)

    return img

def autocrop(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img

def make_icon(size, path, padding_ratio=0.10):
    bg_color = (255, 255, 255)   # blanco

    src = Image.open(SOURCE)
    src = remove_bg(src, tolerance=60)
    src = autocrop(src)

    # Create final canvas with solid dark green background + rounded corners mask
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    # Draw rounded rect mask
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(size * 0.22)
    mask_draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)

    # Green background
    bg = Image.new('RGBA', (size, size), (*bg_color, 255))
    canvas = Image.composite(bg, canvas, mask)

    # Scale and center the ball
    pad = int(size * padding_ratio)
    max_dim = size - 2 * pad
    src_w, src_h = src.size
    scale = min(max_dim / src_w, max_dim / src_h)
    new_w = int(src_w * scale)
    new_h = int(src_h * scale)
    ball = src.resize((new_w, new_h), Image.LANCZOS)

    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(ball, (x, y), ball)

    # Apply rounded corners mask to final result
    final = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    final = Image.composite(canvas, final, mask)

    # Save as RGB
    out = Image.new('RGB', (size, size), bg_color)
    out.paste(final, mask=final.split()[3])
    out.save(path)
    print(f'  Saved {path} ({size}x{size})')


base = 'assets/images'
print('Generating icons from icon_source.png...')
make_icon(1024, f'{base}/icon.png',          padding_ratio=0.10)
make_icon(1024, f'{base}/adaptive-icon.png', padding_ratio=0.18)
make_icon(512,  f'{base}/splash-icon.png',   padding_ratio=0.10)
print('Done!')
