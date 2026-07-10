import re
from dataclasses import dataclass, field

# re.IGNORECASE only folds ASCII letters; Vietnamese Ư is non-ASCII so this
# flag doesn't make the pattern match lowercase 'chương' — it's kept only for
# the ASCII digit/whitespace portion and to signal intent.
CHAPTER_HEADING_RE = re.compile(r"^CHƯƠNG\s+\d+", re.IGNORECASE)


@dataclass
class ChapterBucket:
    title: str
    heading_index: int
    body_indices: list[int] = field(default_factory=list)


def is_chapter_heading(para) -> bool:
    # Matches both properly-styled Heading 1 paragraphs and plain paragraphs
    # whose text starts with "CHƯƠNG N" (common in Vietnamese thesis templates
    # where the style may not be applied consistently).
    return (
        para.style.name.startswith("Heading 1")
        or bool(CHAPTER_HEADING_RE.match(para.text.strip()))
    )


def detect_chapters(doc) -> list[ChapterBucket]:
    # Paragraphs before the first chapter heading (cover, abstract, TOC) are
    # skipped intentionally — current is None until the first heading is seen.
    chapters: list[ChapterBucket] = []
    current: ChapterBucket = None
    for i, para in enumerate(doc.paragraphs):
        if is_chapter_heading(para):
            current = ChapterBucket(title=para.text.strip(), heading_index=i)
            chapters.append(current)
        elif current is not None and para.text.strip():
            current.body_indices.append(i)
    return chapters


def get_paragraph_text(para) -> str:
    # Iterates runs directly rather than using para.text so callers stay in the
    # run-level manipulation model used by replace_paragraph_text.
    return "".join(run.text for run in para.runs)


def replace_paragraph_text(para, new_text: str) -> None:
    if not para.runs:
        return
    para.runs[0].text = new_text
    for run in para.runs[1:]:
        run.text = ""


def clear_paragraph(para) -> None:
    replace_paragraph_text(para, "")
