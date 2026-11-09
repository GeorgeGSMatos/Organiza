"""Package the published WPF client and embedded local engine, without Electron."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
published = root / "release" / f"wpf-{version}"
output = root / "outputs"
output.mkdir(exist_ok=True)
required = ["Organiza.exe", "Organiza.dll", "Organiza.runtimeconfig.json", "coreclr.dll",
            "PresentationFramework.dll", "runtime/node.exe", "runtime/LICENSE-Node.txt",
            "engine/engine/worker.cjs", "engine/engine/server.cjs", "engine/native/worker.ps1", "engine/native/SafeTransfer.cs"]
legal_documents = ("AUTHORS.md", "LICENSE.txt", "EULA.txt", "NOTICE.md")
for name in legal_documents:
    source = root / name
    if not source.is_file():
        raise SystemExit(f"Missing legal document: {name}")
for name in required:
    if not (published / name).is_file():
        raise SystemExit(f"Missing required file: {name}")
for name in ("main.cjs", "preload.cjs"):
    if (published / "engine/main" / name).exists():
        raise SystemExit("Electron entry points must not ship in the WPF package")
for source in (root / "src/main").glob("*.cjs"):
    if source.name not in ("main.cjs", "preload.cjs"):
        if source.read_bytes() != (published / "engine/main" / source.name).read_bytes():
            raise SystemExit("Stale engine module: " + source.name)
for section in ("engine", "native"):
    for source in (root / "src" / section).iterdir():
        if source.is_file() and source.read_bytes() != (published / "engine" / section / source.name).read_bytes():
            raise SystemExit("Stale packaged file: " + str(source))
for name in legal_documents:
    shutil.copy2(root / name, published / name)
shutil.copy2(root / "docs/instalacao.md", published / "LEIA-ME.md")
shutil.copy2(root / "scripts/Update-Organiza.ps1", published / "Atualizar-Organiza.ps1")
archive = output / f"Organiza-{version}-WPF-Windows-x64.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as target:
    for source in sorted(published.rglob("*")):
        if source.is_file() and source.suffix.lower() != ".pdb":
            target.write(source, source.relative_to(published))
with zipfile.ZipFile(archive) as check:
    if check.testzip() is not None:
        raise SystemExit("ZIP integrity check failed")
checksum = f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}\n"
(output / f"SHA256SUMS-{version}.txt").write_text(checksum, encoding="utf-8")
print(f"{archive.name}: {archive.stat().st_size / 1024 / 1024:.1f} MiB")
