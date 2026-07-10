import warnings
from pathlib import Path

MAX_CONTEXT_CHARS = 100_000


def load_context(path: str) -> str:
    p = Path(path)
    if p.is_file():
        try:
            return p.read_text(encoding="utf-8")
        except UnicodeDecodeError as e:
            raise ValueError(f"Cannot read {path} as UTF-8 text: {e}") from e
    if not p.is_dir():
        raise FileNotFoundError(f"Context path not found: {path}")

    files = sorted(p.glob("**/*.md"))
    if not files:
        warnings.warn(f"No .md files in {path}, trying .txt fallback")
        files = sorted(p.glob("**/*.txt"))
    if not files:
        raise ValueError(f"No readable files (.md or .txt) in {path}")

    parts = []
    for f in files:
        try:
            parts.append(f.read_text(encoding="utf-8"))
        except OSError as e:
            warnings.warn(f"Skipping {f}: {e}")

    if not parts:
        raise ValueError(f"No files could be read from {path}")

    combined = "\n\n---\n\n".join(parts)
    if len(combined) > MAX_CONTEXT_CHARS:
        warnings.warn(
            f"Context {len(combined)} chars exceeds {MAX_CONTEXT_CHARS}, truncating"
        )
        sep = "\n\n[...TRUNCATED...]\n\n"
        half = (MAX_CONTEXT_CHARS - len(sep)) // 2
        combined = combined[:half] + sep + combined[-half:]

    return combined
