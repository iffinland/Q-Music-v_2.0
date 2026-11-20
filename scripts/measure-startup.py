"""Run npm run build -- --manifest first, then python3 scripts/measure-startup.py.
Measures static import closure for main + first home/shell route; this is an
asset-graph size measurement, not a network/device timing benchmark.
"""
from pathlib import Path
import gzip
import json
root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'dist/.vite/manifest.json').read_text())
seen = set()
def visit(key):
    if key in seen: return
    seen.add(key)
    for dependency in manifest[key].get('imports', []): visit(dependency)
for key in ['index.html', 'src/AppWrapper.tsx', 'src/App.tsx']:
    if key in manifest: visit(key)
files = {manifest[key]['file'] for key in seen}
for key in seen: files.update(manifest[key].get('css', []))
print(json.dumps({
    'entry_graph_files': sorted(files),
    'entry_graph_bytes': sum((root / 'dist' / file).stat().st_size for file in files),
    'entry_graph_gzip_bytes': sum(len(gzip.compress((root / 'dist' / file).read_bytes(), compresslevel=9)) for file in files),
    'font_bytes': sum(p.stat().st_size for p in (root / 'dist/assets').glob('*.woff2')),
}, indent=2))
