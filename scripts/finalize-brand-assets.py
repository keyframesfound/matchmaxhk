from pathlib import Path
from PIL import Image

public = Path('/home/ubuntu/matchmaxhk/public')
source = Path('/home/ubuntu/matchmaxhk/public/matchmax-logo-ai.png')
with Image.open(source).convert('RGBA') as source_image:
    icon = source_image.copy()

# Remove the neutral grayscale checkerboard matte while preserving all colored
# logo gradients and edges.
pixels = icon.load()
for y in range(icon.height):
    for x in range(icon.width):
        r, g, b, _ = pixels[x, y]
        if max(r, g, b) - min(r, g, b) <= 12 and min(r, g, b) >= 80:
            pixels[x, y] = (r, g, b, 0)

bbox = icon.getbbox()
icon = icon.crop(bbox) if bbox else icon

# Match the existing 500x500 public asset and favicon/app-icon resolutions.
def square(size: int) -> Image.Image:
    scale = min((size * 0.88) / icon.width, (size * 0.88) / icon.height)
    resized = icon.resize((round(icon.width * scale), round(icon.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas

square(500).save(public / 'matchmax-logo.png', 'PNG', optimize=True)
square(180).save(public / 'apple-touch-icon.png', 'PNG', optimize=True)
square(32).save(public / 'favicon-32x32.png', 'PNG', optimize=True)
square(16).save(public / 'favicon-16x16.png', 'PNG', optimize=True)
square(48).save(public / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
square(32).save(public / 'favicon.png', 'PNG', optimize=True)

for name in ('matchmax-logo.png', 'apple-touch-icon.png', 'favicon-32x32.png', 'favicon-16x16.png', 'favicon.ico', 'favicon.png'):
    path = public / name
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        print(f'{name}: {image.size} {image.mode} {path.stat().st_size} bytes')
