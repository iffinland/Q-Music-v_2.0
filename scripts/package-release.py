"""Package the clean committed checkout and its built Q-App; no credentials needed."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
assert re.fullmatch(r'\d+\.\d+\.\d+', version), 'A stable version is required.'
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=root).strip(), 'Commit changes before packaging a release.'
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
dist = root / 'dist'
assert f'Q-Music {version}' in (dist / 'index.html').read_text(), 'Build version does not match.'
assert f"appVersion = '{version}'" in (root / 'src/qapp-config.ts').read_text()
assert (dist / 'fonts-OFL.txt').is_file()
assert not (dist / 'sw-video-decrypt.js').exists()
assert not list((dist / 'assets').glob('*qapp-core*'))
refs_checked = 0
for path in dist.rglob('*'):
    if not path.is_file():
        continue
    if path.suffix == '.html':
        refs = re.findall(r'(?:src|href)="([^"#]+)"', path.read_text())
    elif path.suffix == '.css':
        refs = re.findall(r'url\([\"\x27]?([^\)\"\x27]+)', path.read_text())
    elif path.suffix == '.js':
        refs = re.findall(r'(?:from\s*|import\s*\()"(\.[^"\n]+)"', path.read_text())
    else:
        continue
    for ref in refs:
        if ref.startswith(('http:', 'https:', 'data:', '#')):
            continue
        assert not ref.startswith('/'), (path, ref)
        assert (path.parent / ref.split('?')[0].split('#')[0]).is_file(), (path, ref)
        refs_checked += 1
out = root / 'release-assets'
out.mkdir(exist_ok=True)
runtime = out / f'Q-Music_{version}.zip'
with zipfile.ZipFile(runtime, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(dist.rglob('*')):
        relative = path.relative_to(dist)
        if path.is_file() and '.vite' not in relative.parts:
            info = zipfile.ZipInfo(relative.as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)
source = out / f'Q-Music_{version}_source.zip'
subprocess.run(['git', 'archive', '--format=zip', f'--prefix=Q-Music_{version}/', '-o', str(source), 'HEAD'], cwd=root, check=True)
for path in (runtime, source):
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
provenance = out / 'BUILD-INFO.json'
provenance.write_text(json.dumps({'version': version, 'commit': commit, 'relative_asset_references_checked': refs_checked, 'runtime': runtime.name, 'source': source.name}, indent=2) + '\n')
checksums = out / 'SHA256SUMS.txt'
checksums.write_text(''.join(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n' for path in (runtime, source, provenance)))
print(json.dumps({'version': version, 'commit': commit, 'assets': [p.name for p in (runtime, source, provenance, checksums)], 'asset_references_checked': refs_checked}, indent=2))
