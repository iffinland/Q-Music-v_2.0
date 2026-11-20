"""Optional asset regeneration: python3 -m pip install fonttools brotli.
All existing characters/metrics and license metadata are preserved (no subset).
"""
from pathlib import Path
from fontTools.ttLib import TTFont
root = Path(__file__).resolve().parent.parent
for weight in ['Regular', 'SemiBold', 'Bold', 'ExtraBold']:
    source = root / 'src/styles/fonts' / f'Inter-{weight}.ttf'
    original = TTFont(source)
    original.flavor = 'woff2'
    destination = source.with_suffix('.woff2')
    original.save(destination)
    encoded = TTFont(destination)
    assert original.getBestCmap() == encoded.getBestCmap()
    assert original['hmtx'].metrics == encoded['hmtx'].metrics
    print(source.name, source.stat().st_size, destination.stat().st_size)
