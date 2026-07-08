from __future__ import annotations

import textwrap
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "samples"
DOCX_PATH = OUT_DIR / "java-backend-high-match-cv.docx"
PDF_PATH = OUT_DIR / "java-backend-high-match-cv.pdf"
JD_PATH = OUT_DIR / "java-backend-onet-jd.md"


JD_MARKDOWN = """# Java Backend Sample JD

Source basis:
- O*NET occupation: `15-1252.00 - Software Developers`
- O*NET title: `Software Developers`
- O*NET API date in response: `2026`

Why this role was chosen:
- It is the closest O*NET occupation to a Java Backend Engineer in the current O*NET search results.
- The technology summary includes Java, Maven, Spring Framework, Tomcat, RESTful API, SQL, Linux, AWS, and Kafka-related tooling.

## Job Title

Senior Java Backend Engineer

## Role Summary

Design, build, test, and improve backend services for business-critical applications. Analyze user and business requirements, develop scalable software solutions, enhance existing services, and work with analysts, QA engineers, and DevOps engineers to deliver reliable systems in production.

## Core Responsibilities

- Analyze business and user requirements and translate them into backend design decisions.
- Design and develop RESTful APIs and backend modules using Java and Spring Boot.
- Build and maintain software validation, testing, and technical documentation.
- Modify existing services to correct errors, improve performance, and support new integrations.
- Collaborate with analysts, engineers, and developers on system capabilities, interfaces, and constraints.
- Prepare technical status updates and implementation notes for ongoing projects.

## Must-Have Skills

- Java
- Spring Framework / Spring Boot
- RESTful API design
- SQL and relational databases
- Maven or Gradle
- Software testing and debugging
- System design and performance optimization
- Linux production environment basics

## Nice-to-Have Skills

- Apache Kafka
- RabbitMQ
- AWS
- Docker
- Tomcat
- CI/CD pipelines
- Observability and logging

## Preferred Experience

- 4+ years of backend software development experience
- Experience building production APIs and enterprise services
- Experience improving existing applications and integrating with related systems
- Experience working with QA, DevOps, and business stakeholders

## Education

- Bachelor degree in Computer Science, Software Engineering, or a related field
"""


CV_LINES = [
    "NGUYEN MINH KHANG",
    "Senior Java Backend Engineer",
    "Ho Chi Minh City | khang.nguyen.dev@example.com | +84 903 555 018 | github.com/khangjava",
    "",
    "PROFESSIONAL SUMMARY",
    "Backend engineer with 6+ years of experience building Java services for fintech and e-commerce platforms.",
    "Strong in Java, Spring Boot, RESTful APIs, SQL, Maven, Kafka, RabbitMQ, Linux, AWS, and performance tuning.",
    "Delivered high-availability services, improved latency, and collaborated closely with QA, DevOps, and product teams.",
    "",
    "CORE SKILLS",
    "Java, Spring Boot, Spring Framework, REST API design, SQL, PostgreSQL, MySQL, Maven, Gradle,",
    "Kafka, RabbitMQ, Redis, Docker, Tomcat, Linux, AWS, JUnit, Testcontainers, CI/CD, system design.",
    "",
    "PROFESSIONAL EXPERIENCE",
    "Senior Java Backend Engineer | Lumina Commerce | 2022 - Present",
    "- Designed and implemented 18+ Spring Boot microservices for order, payment, and inventory workflows.",
    "- Built RESTful APIs used by web and partner systems, serving 1.8M requests per day.",
    "- Improved p95 response time by 34% through SQL optimization, caching, and async event processing.",
    "- Developed Kafka and RabbitMQ consumers for payment, recommendation, and notification pipelines.",
    "- Wrote automated integration tests and deployment runbooks with QA and DevOps teams.",
    "- Deployed services on AWS EC2, RDS, S3, and CloudWatch with Linux-based runtime operations.",
    "",
    "Java Backend Engineer | Nova Fintech | 2019 - 2022",
    "- Developed Java 17 and Spring Boot services for wallet, billing, and user account operations.",
    "- Maintained Tomcat-based internal applications and migrated core APIs to containerized deployments.",
    "- Created SQL data models, stored procedures, and reporting queries for PostgreSQL and MySQL.",
    "- Partnered with systems analysts and product owners to translate business requirements into backend solutions.",
    "- Reduced production incidents by improving validation, logging, retry policies, and test coverage.",
    "",
    "Software Developer | Bright Systems | 2017 - 2019",
    "- Built backend modules in Java for document processing and business workflow applications.",
    "- Fixed defects, upgraded interfaces, and improved application performance for enterprise customers.",
    "- Prepared technical reports, implementation notes, and release documentation for project stakeholders.",
    "",
    "SELECTED PROJECTS",
    "Payment Event Processing Platform",
    "- Built a Java Spring Boot event-driven platform using RabbitMQ and Kafka for payment status updates.",
    "- Implemented idempotent consumers, retry policies, and monitoring dashboards for message processing.",
    "",
    "Merchant Settlement API",
    "- Designed secure RESTful APIs for merchant settlements, reconciliation, and reporting.",
    "- Optimized SQL queries and batch processing to reduce settlement runtime from 45 to 18 minutes.",
    "",
    "EDUCATION",
    "B.Sc. in Computer Science | Ho Chi Minh City University of Technology | 2017",
    "",
    "CERTIFICATIONS",
    "AWS Certified Developer - Associate",
    "Oracle Certified Professional: Java SE Developer",
]


def xml_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_docx(path: Path, lines: list[str]) -> None:
    body_parts = []
    for line in lines:
        if line == "":
            body_parts.append("<w:p/>")
            continue
        body_parts.append(
            "<w:p><w:r><w:t xml:space=\"preserve\">"
            + xml_escape(line)
            + "</w:t></w:r></w:p>"
        )

    document_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\" "
        "xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" "
        "xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" "
        "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
        "xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
        "xmlns:w10=\"urn:schemas-microsoft-com:office:word\" "
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\" "
        "xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\" "
        "xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\" "
        "xmlns:wne=\"http://schemas.microsoft.com/office/2006/wordml\" "
        "xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\" "
        "mc:Ignorable=\"w14 wp14\">"
        "<w:body>"
        + "".join(body_parts)
        + "<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/></w:sectPr>"
        "</w:body></w:document>"
    )

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
"""

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/_rels/document.xml.rels", doc_rels)


def pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_pdf(path: Path, lines: list[str]) -> None:
    content = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL"]
    first = True
    for line in lines:
        if not first:
            content.append("T*")
        first = False
        if line == "":
            content.append("() Tj")
        else:
            wrapped = textwrap.wrap(line, width=92) or [""]
            first_chunk = True
            for chunk in wrapped:
                if not first_chunk:
                    content.append("T*")
                first_chunk = False
                content.append(f"({pdf_escape(chunk)}) Tj")
    content.append("ET")
    stream = "\n".join(content).encode("latin-1", errors="replace")

    objects: list[bytes] = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    objects.append(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
    objects.append(
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
    )
    objects.append(b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")
    objects.append(
        f"5 0 obj << /Length {len(stream)} >> stream\n".encode("latin-1")
        + stream
        + b"\nendstream endobj\n"
    )

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects)+1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
    pdf.extend(
        (
            f"trailer << /Size {len(objects)+1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("latin-1")
    )

    path.write_bytes(pdf)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    JD_PATH.write_text(JD_MARKDOWN, encoding="utf-8")
    build_docx(DOCX_PATH, CV_LINES)
    build_pdf(PDF_PATH, CV_LINES)
    print(f"Wrote {JD_PATH}")
    print(f"Wrote {DOCX_PATH}")
    print(f"Wrote {PDF_PATH}")


if __name__ == "__main__":
    main()
