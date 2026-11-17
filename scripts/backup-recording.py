"""Copy one catalog recording to a portable directory, retaining its HLS playlists."""
import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import tempfile
import time
from pathlib import Path
from urllib.parse import unquote, urljoin
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def download(url):
    for attempt in range(3):
        try:
            with urlopen(url, timeout=30) as response:
                data = response.read()
                length = response.headers.get("Content-Length")
                if not data or (length and len(data) != int(length)):
                    raise IOError("Incomplete response for " + url)
                return data
        except OSError:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def backup_playlist(url, folder):
    folder.mkdir()
    manifest = download(url)
    lines = manifest.decode("utf-8-sig").splitlines()
    if lines[0] != "#EXTM3U" or "#EXT-X-ENDLIST" not in lines:
        raise ValueError("Expected a complete VOD playlist: " + url)
    supported = {"#EXTM3U", "#EXT-X-VERSION", "#EXT-X-TARGETDURATION",
                 "#EXT-X-MEDIA-SEQUENCE", "#EXTINF", "#EXT-X-ENDLIST"}
    if any(line.startswith("#EXT") and line.split(":")[0] not in supported for line in lines):
        raise ValueError("Playlist contains references that need special handling: " + url)
    entries = [line for line in lines if line and not line.startswith("#")]
    if not entries or any(not re.fullmatch(r"[\w ()'.-]+\.ts", unquote(name)) for name in entries):
        raise ValueError("Expected relative segment filenames: " + url)

    def copy(name):
        data = download(urljoin(url, name.replace(" ", "%20")))
        target = folder / unquote(name)
        target.write_bytes(data)
        return {"file": target.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        files = list(pool.map(copy, dict.fromkeys(entries)))
    (folder / "index.m3u8").write_bytes(manifest)
    return {"source": url, "playlist": folder.name + "/index.m3u8",
            "playlist_sha256": hashlib.sha256(manifest).hexdigest(), "files": files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("catalog_id")
    parser.add_argument("directory", type=Path, help="Parent directory for the new backup")
    args = parser.parse_args()
    records = []
    for collection in ("mixes", "releases"):
        records.extend(json.loads((ROOT / "src/content" / collection / "records.json").read_text()))
    record = next((r for r in records if r["id"] == args.catalog_id), None)
    if record is None:
        parser.error("Unknown catalog ID")
    args.directory.mkdir(parents=True, exist_ok=True)
    target = args.directory / record["id"]
    if target.exists():
        parser.error("Backup destination already exists: " + str(target))
    defaults = json.loads((ROOT / "src/content/media-defaults.json").read_text())
    origin = (os.environ.get("ROOM_MEDIA_ORIGIN") or defaults["origin"]).rstrip("/") + "/"
    tracks = record.get("tracks") or [{"name": record.get("name", record["artist"]), "streamPath": record["audioPath"]}]
    with tempfile.TemporaryDirectory(prefix="." + record["id"] + "-", dir=args.directory) as staging:
        output = Path(staging) / record["id"]
        output.mkdir()
        manifests = []
        for i, track in enumerate(tracks, 1):
            path = track["streamPath"]
            url = urljoin(origin, path)
            if path == defaults["mx029Audio"]:
                url = os.environ.get("ROOM_MX029_AUDIO_URL") or url
            manifests.append({**backup_playlist(url, output / f"track-{i:02}"), "name": track["name"]})
        (output / "backup.json").write_text(json.dumps({"record":record["id"], "artist":record["artist"], "tracks":manifests},indent=2) + "\n")
        os.rename(output,target)
    print(f"{target}: {len(manifests)} playlist(s), {sum(len(m['files']) for m in manifests)} segments")


if __name__ == "__main__":
    main()
