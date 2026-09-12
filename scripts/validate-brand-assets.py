from pathlib import Path
from PIL import Image

for name in ('matchmax-logo.png', 'apple-touch-icon.png', 'favicon-32x32.png', 'favicon-16x16.png', 'favicon.ico', 'favicon.png'):
    path = Path('/home/ubuntu/matchmaxhk/public') / name
    with Image.open(path).convert('RGBA') as image:
        alpha = image.getchannel('A')
        extrema = alpha.getextrema()
        corners = [image.getpixel(point) for point in [(0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1)]]
        print(f'{name}: size={image.size}, alpha={extrema}, corners={corners}')
