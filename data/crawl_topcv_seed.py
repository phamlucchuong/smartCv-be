#!/usr/bin/env python3
"""
Materialize a TopCV-backed seed snapshot for SmartCV.

Why this script is snapshot-based instead of live HTML crawling:
- TopCV actively blocks headless/raw HTTP requests with Cloudflare in this environment.
- The recruiter/job source data below was curated from browser-rendered TopCV pages.
- Company logos are still downloaded from TopCV CDN at runtime, saved locally, then
  uploaded to S3 before the final SQL is generated.

Outputs:
- data/images/*                  downloaded TopCV logos
- data/seed_recruiter.sql        SQL seed snapshot
"""

from __future__ import annotations

import json
import mimetypes
import re
import subprocess
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
IMAGES_DIR = DATA_DIR / "images"
ENV_FILE = ROOT / "backend" / ".env"
SQL_FILE = DATA_DIR / "seed_recruiter.sql"

PASSWORD_HASH = "$2a$10$mGl6Qnn6RPj5sCcQojIFj.yvBtWF88/whqo57Hllz2XcbZUO1Rx5."
NOW = datetime(2026, 6, 20, 10, 0, 0)
JOB_DEADLINE = date(2026, 8, 31)


@dataclass(frozen=True)
class RecruiterSnapshot:
    code: str
    company_name: str
    status: str
    company_website: str
    company_address: str
    company_city: str
    company_description: str
    company_phone: str | None
    company_size: str
    company_type: str
    founded_year: int | None
    industry: str
    benefits: list[str]
    rating: float | None
    review_count: int | None
    tax_code: str | None
    linkedin_url: str | None
    facebook_url: str | None
    contact_name: str
    contact_email: str
    contact_phone: str
    source_page: str
    logo_source_url: str


@dataclass(frozen=True)
class JobSnapshot:
    code: str
    recruiter_code: str
    title: str
    source_page: str
    salary_min: float | None
    salary_max: float | None
    location: str
    experience_label: str
    skills: list[str]
    requirements: list[str]
    benefits: list[str]
    openings: int


RECRUITERS: list[RecruiterSnapshot] = [
    RecruiterSnapshot(
        code="sapo",
        company_name="Công ty cổ phần Công nghệ Sapo",
        status="APPROVED",
        company_website="https://tuyendung.sapo.vn/",
        company_address="Tầng 6, Tòa Ladeco, 266 Đội Cấn, Quận Ba Đình, TP Hà Nội",
        company_city="Hà Nội",
        company_description=(
            "Sapo là nền tảng quản lý bán hàng hợp kênh được sử dụng rộng rãi tại Việt Nam. "
            "Doanh nghiệp được thành lập năm 2008, tập trung vào công nghệ bán lẻ, thương mại điện tử "
            "và các giải pháp số giúp nhà bán hàng tăng trưởng doanh thu."
        ),
        company_phone="0765588715",
        company_size="500-1000 nhân viên",
        company_type="PRODUCT_COMPANY",
        founded_year=2008,
        industry="IT - Phần mềm",
        benefits=[
            "Thu nhập cạnh tranh theo năng lực",
            "Môi trường công nghệ tăng trưởng nhanh",
            "Đào tạo nội bộ và lộ trình thăng tiến rõ ràng",
        ],
        rating=4.7,
        review_count=40,
        tax_code="0103243195",
        linkedin_url="https://www.linkedin.com/company/sapo-tech/",
        facebook_url="https://www.facebook.com/sapo.vn",
        contact_name="Sapo Talent Acquisition",
        contact_email="tuyendung@sapo.vn",
        contact_phone="0765588715",
        source_page="https://www.topcv.vn/brand/sapovn?id=11698",
        logo_source_url=(
            "https://cdn-new.topcv.vn/unsafe/https%3A//static.topcv.vn/company_logos/"
            "cong-ty-co-phan-cong-nghe-sapo-6166c32089ac7.jpg"
        ),
    ),
    RecruiterSnapshot(
        code="vnpay",
        company_name="Công ty CP Giải pháp Thanh toán Việt Nam (VNPAY)",
        status="APPROVED",
        company_website="https://vnpay.vn/",
        company_address="Hà Nội, Việt Nam",
        company_city="Hà Nội",
        company_description=(
            "VNPAY thành lập tháng 03/2007, là doanh nghiệp hàng đầu về thanh toán điện tử tại Việt Nam. "
            "Công ty phát triển sản phẩm trong các lĩnh vực tài chính ngân hàng, công nghệ thông tin và viễn thông."
        ),
        company_phone=None,
        company_size="2000+ nhân sự",
        company_type="FINTECH",
        founded_year=2007,
        industry="Tài chính - Công nghệ thanh toán",
        benefits=[
            "Dự án quy mô lớn trong fintech",
            "Môi trường chuyên nghiệp, chú trọng sáng tạo",
            "Làm việc cùng hệ sinh thái ngân hàng và thanh toán số",
        ],
        rating=4.6,
        review_count=18,
        tax_code=None,
        linkedin_url="https://www.linkedin.com/company/vnpay/",
        facebook_url="https://www.facebook.com/VNPAYQR/",
        contact_name="VNPAY Recruitment",
        contact_email="recruitment@vnpay.vn",
        contact_phone="0901002003",
        source_page="https://www.topcv.vn/cong-ty/cong-ty-cp-giai-phap-thanh-toan-viet-nam-vnpay/200858.html",
        logo_source_url=(
            "https://cdn-new.topcv.vn/unsafe/https%3A//static.topcv.vn/company_logos/"
            "cong-ty-cp-giai-phap-thanh-toan-viet-nam-vnpay-6194ba1fa3d66.jpg"
        ),
    ),
    RecruiterSnapshot(
        code="novaon",
        company_name="Tập Đoàn Novaon",
        status="APPROVED",
        company_website="https://novaon.net",
        company_address="Hà Nội, Việt Nam",
        company_city="Hà Nội",
        company_description=(
            "Novaon được thành lập năm 2006, hoạt động trong ba mảng chính gồm tiếp thị số, công nghiệp và "
            "thương mại điện tử. Doanh nghiệp sở hữu hệ sinh thái sản phẩm công nghệ và phục vụ hàng chục nghìn khách hàng."
        ),
        company_phone=None,
        company_size="1000+ nhân sự",
        company_type="TECH_GROUP",
        founded_year=2006,
        industry="Digital Marketing / IT - Phần mềm",
        benefits=[
            "Hệ sinh thái công nghệ và marketing số lớn",
            "Nhiều cơ hội chuyển dự án và phát triển chuyên môn",
            "Môi trường tăng trưởng nhanh, hướng tới thị trường quốc tế",
        ],
        rating=4.5,
        review_count=27,
        tax_code=None,
        linkedin_url="https://www.linkedin.com/company/novaon-group/",
        facebook_url="https://www.facebook.com/NovaonGroup",
        contact_name="Novaon Talent Team",
        contact_email="talent@novaon.net",
        contact_phone="0901002004",
        source_page="https://www.topcv.vn/cong-ty/tap-doan-novaon/201092.html",
        logo_source_url=(
            "https://cdn-new.topcv.vn/unsafe/https%3A//static.topcv.vn/company_logos/"
            "tyBj2W3vZeCseekQxuhbc01mOjP0OvRR_1639129111____82268025e34598ac77ab32a2e723b2ae.png"
        ),
    ),
    RecruiterSnapshot(
        code="icheck",
        company_name="Công ty cổ phần iCheck",
        status="PENDING",
        company_website="https://careers.icheck.com.vn/",
        company_address="Hà Nội, Việt Nam",
        company_city="Hà Nội",
        company_description=(
            "iCheck thành lập năm 2015, phát triển từ ứng dụng quét mã sang hệ sinh thái giải pháp số hóa sản phẩm, "
            "minh bạch thông tin và hỗ trợ chuyển đổi số cho doanh nghiệp."
        ),
        company_phone=None,
        company_size="200-500 nhân sự",
        company_type="PRODUCT_COMPANY",
        founded_year=2015,
        industry="IT - Phần mềm / Chuyển đổi số",
        benefits=[
            "Sản phẩm công nghệ có tác động thực tế đến doanh nghiệp và người tiêu dùng",
            "Môi trường làm việc dữ liệu và tăng trưởng",
            "Định hướng chuyển đổi số bài bản",
        ],
        rating=4.4,
        review_count=6,
        tax_code=None,
        linkedin_url="https://www.linkedin.com/company/icheck-corporation/",
        facebook_url="https://www.facebook.com/iCheckCorporation",
        contact_name="iCheck Hiring Team",
        contact_email="careers@icheck.com.vn",
        contact_phone="0901002005",
        source_page="https://www.topcv.vn/cong-ty/cong-ty-co-phan-icheck/1319.html",
        logo_source_url=(
            "https://cdn-new.topcv.vn/unsafe/https%3A//static.topcv.vn/company_logos/"
            "cong-ty-co-phan-icheck-5eead4135770b.jpg"
        ),
    ),
    RecruiterSnapshot(
        code="pjsb",
        company_name="CÔNG TY TNHH PJSB",
        status="PENDING",
        company_website="https://www.topcv.vn/cong-ty/cong-ty-tnhh-pjsb/225311.html",
        company_address="Hà Nội, Việt Nam",
        company_city="Hà Nội",
        company_description=(
            "PJSB thành lập năm 2023, hoạt động trong lĩnh vực phân phối thực phẩm chức năng, mỹ phẩm "
            "và các sản phẩm chăm sóc sức khỏe, sắc đẹp."
        ),
        company_phone=None,
        company_size="100-499 nhân viên",
        company_type="DISTRIBUTOR",
        founded_year=2023,
        industry="Bán lẻ - Hàng tiêu dùng - FMCG",
        benefits=[
            "Môi trường phát triển thị trường nhanh",
            "Sản phẩm chăm sóc sức khỏe và làm đẹp chính hãng",
            "Định hướng mở rộng hệ thống phân phối toàn quốc",
        ],
        rating=4.1,
        review_count=3,
        tax_code=None,
        linkedin_url=None,
        facebook_url=None,
        contact_name="PJSB HR Team",
        contact_email="hr@pjsb.vn",
        contact_phone="0901002006",
        source_page="https://www.topcv.vn/cong-ty/cong-ty-tnhh-pjsb/225311.html",
        logo_source_url=(
            "https://cdn-new.topcv.vn/unsafe/https%3A//static.topcv.vn/company_logos/69b381f7cc4841773371895.jpg"
        ),
    ),
]


JOBS: list[JobSnapshot] = [
    JobSnapshot(
        code="sapo-consulting-01",
        recruiter_code="sapo",
        title="Chuyên Viên Tư Vấn Phần Mềm/Website [Toàn Quốc] - Lương Cơ Bản Upto 13 Triệu + Hoa Hồng 43% + Phụ Cấp, Open Fresher",
        source_page="https://www.topcv.vn/brand/sapovn?id=11698",
        salary_min=12_000_000,
        salary_max=35_000_000,
        location="Hà Nội",
        experience_label="Dưới 1 năm",
        skills=["Tư vấn giải pháp", "CRM", "SaaS", "Sales B2B", "Website"],
        requirements=[
            "Có khả năng giao tiếp và tư vấn giải pháp phần mềm cho khách hàng doanh nghiệp",
            "Chủ động học nhanh về sản phẩm SaaS và website",
            "Ưu tiên ứng viên có định hướng kinh doanh công nghệ",
        ],
        benefits=["Lương cứng và hoa hồng rõ ràng", "Đào tạo sản phẩm", "Cơ hội phát triển sales công nghệ"],
        openings=4,
    ),
    JobSnapshot(
        code="sapo-fullstack-02",
        recruiter_code="sapo",
        title="Fullstack Developer [Hà Nội] - Thu Nhập Cạnh Tranh, Từ 4 Năm Kinh Nghiệm",
        source_page="https://www.topcv.vn/brand/sapovn?id=11698",
        salary_min=None,
        salary_max=None,
        location="Hà Nội",
        experience_label="4 năm",
        skills=["JavaScript", "TypeScript", "Node.js", "React", "SQL"],
        requirements=[
            "Có kinh nghiệm phát triển fullstack từ 4 năm trở lên",
            "Hiểu kiến trúc web hiện đại và tối ưu hiệu năng hệ thống",
            "Có kinh nghiệm phối hợp chặt chẽ với đội sản phẩm",
        ],
        benefits=["Dự án sản phẩm lớn", "Thu nhập cạnh tranh", "Môi trường kỹ thuật hiện đại"],
        openings=2,
    ),
    JobSnapshot(
        code="sapo-bde-03",
        recruiter_code="sapo",
        title="Business Development Executive (B2B) - Thu Nhập Upto 40 Triệu, Phúc Lợi Hấp Dẫn",
        source_page="https://www.topcv.vn/brand/sapovn?id=11698",
        salary_min=15_000_000,
        salary_max=40_000_000,
        location="Hà Nội",
        experience_label="1 năm",
        skills=["Business Development", "B2B Sales", "Pipeline", "Presentation"],
        requirements=[
            "Có kinh nghiệm làm việc với khách hàng doanh nghiệp",
            "Biết xây dựng pipeline và theo dõi cơ hội kinh doanh",
            "Kỹ năng trình bày giải pháp tốt",
        ],
        benefits=["Thu nhập lên tới 40 triệu", "Phúc lợi hấp dẫn", "Tăng trưởng theo hiệu quả kinh doanh"],
        openings=3,
    ),
    JobSnapshot(
        code="sapo-driver-04",
        recruiter_code="sapo",
        title="Nhân Viên Lái Xe Văn Phòng",
        source_page="https://www.topcv.vn/brand/sapovn?id=11698",
        salary_min=12_000_000,
        salary_max=15_000_000,
        location="Hà Nội",
        experience_label="1 năm",
        skills=["Lái xe", "An toàn giao thông", "Hỗ trợ hành chính"],
        requirements=[
            "Có bằng lái phù hợp và kinh nghiệm lái xe văn phòng",
            "Tác phong chuyên nghiệp và đúng giờ",
            "Hỗ trợ công việc vận hành khi cần",
        ],
        benefits=["Mức lương ổn định", "Môi trường doanh nghiệp công nghệ", "Phúc lợi theo chính sách công ty"],
        openings=1,
    ),
    JobSnapshot(
        code="sapo-enterprise-05",
        recruiter_code="sapo",
        title="Business Development Executive (B2B/Sapo Enterprise) - Lương Cơ Bản Upto 21 Triệu + Hoa Hồng + Phụ Cấp",
        source_page="https://www.topcv.vn/brand/sapovn?id=11698",
        salary_min=12_000_000,
        salary_max=40_000_000,
        location="Hà Nội",
        experience_label="2 năm",
        skills=["Enterprise Sales", "B2B", "Solution Selling", "Negotiation"],
        requirements=[
            "Có khả năng bán giải pháp enterprise cho khách hàng doanh nghiệp lớn",
            "Kỹ năng đàm phán và theo đuổi hợp đồng tốt",
            "Chủ động quản lý cơ hội bán hàng dài hạn",
        ],
        benefits=["Lương cứng cao", "Hoa hồng và phụ cấp", "Làm việc với phân khúc khách hàng lớn"],
        openings=2,
    ),
    JobSnapshot(
        code="vnpay-ba-01",
        recruiter_code="vnpay",
        title="Business Analyst",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=None,
        salary_max=None,
        location="Hà Nội",
        experience_label="3 năm",
        skills=["Business Analysis", "UML", "SQL", "Fintech", "Agile"],
        requirements=[
            "Từ 3 năm kinh nghiệm phân tích nghiệp vụ",
            "Có khả năng làm việc giữa business và engineering",
            "Ưu tiên hiểu biết sản phẩm tài chính hoặc thanh toán",
        ],
        benefits=["Dự án fintech quy mô lớn", "Quy trình sản phẩm rõ ràng", "Cơ hội làm việc đa phòng ban"],
        openings=2,
    ),
    JobSnapshot(
        code="vnpay-java-02",
        recruiter_code="vnpay",
        title="Kỹ Sư Java Backend",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=None,
        salary_max=None,
        location="Hà Nội",
        experience_label="2 năm",
        skills=["Java", "Spring Boot", "Microservices", "SQL", "REST API"],
        requirements=[
            "Có tối thiểu 2 năm kinh nghiệm backend Java",
            "Hiểu microservices, API và hệ thống tích hợp",
            "Ưu tiên ứng viên từng làm dự án giao dịch lớn",
        ],
        benefits=["Hệ thống transaction lớn", "Môi trường kỹ thuật mạnh", "Cơ hội phát triển backend chuyên sâu"],
        openings=3,
    ),
    JobSnapshot(
        code="vnpay-sales-03",
        recruiter_code="vnpay",
        title="Sales Manager ICT (B2B) - HCM",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=None,
        salary_max=None,
        location="Hồ Chí Minh",
        experience_label="2 năm",
        skills=["B2B Sales", "ICT", "Account Management", "Negotiation"],
        requirements=[
            "Có kinh nghiệm dẫn dắt hoạt động sales B2B trong lĩnh vực ICT",
            "Kỹ năng quản lý tài khoản và phát triển doanh số tốt",
            "Chủ động làm việc với khách hàng doanh nghiệp",
        ],
        benefits=["Mở rộng mạng lưới khách hàng doanh nghiệp", "Môi trường B2B năng động", "Cơ hội tăng trưởng theo doanh số"],
        openings=1,
    ),
    JobSnapshot(
        code="vnpay-ai-04",
        recruiter_code="vnpay",
        title="Senior QA Manager (AI & Enterprise Software) - Thu Nhập Upto 50 Triệu - Hà Nội",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=30_000_000,
        salary_max=50_000_000,
        location="Hà Nội",
        experience_label="5 năm",
        skills=["QA Strategy", "AI Systems", "Test Management", "Automation", "Leadership"],
        requirements=[
            "Có kinh nghiệm quản lý QA và kiểm thử hệ thống enterprise",
            "Hiểu chiến lược kiểm thử cho sản phẩm tích hợp AI",
            "Có khả năng dẫn dắt team và chuẩn hóa quy trình chất lượng",
        ],
        benefits=["Mức thu nhập senior", "Vai trò quản lý chất lượng", "Làm việc với sản phẩm nhiều tích hợp"],
        openings=1,
    ),
    JobSnapshot(
        code="vnpay-data-05",
        recruiter_code="vnpay",
        title="Nhân Viên Thiết Kế AI - Thu Nhập Upto 22 Triệu /Tháng, Từ 2 Năm Kinh Nghiệm + Gửi Kèm Sản Phẩm",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=12_000_000,
        salary_max=22_000_000,
        location="Hà Nội",
        experience_label="2 năm",
        skills=["AI Design", "Creative", "Prompting", "Visual Design"],
        requirements=[
            "Có tư duy thiết kế và khả năng làm việc với công cụ AI",
            "Có portfolio hoặc sản phẩm kèm theo",
            "Chủ động phối hợp với team sản phẩm và marketing",
        ],
        benefits=["Thu nhập cạnh tranh", "Cơ hội thử nghiệm công cụ AI", "Môi trường làm việc sáng tạo"],
        openings=1,
    ),
    JobSnapshot(
        code="novaon-dev-01",
        recruiter_code="novaon",
        title="CAD/CAM Engineer / Kỹ Sư Lập Trình CNC - Hybrid Working",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=None,
        salary_max=None,
        location="Hồ Chí Minh",
        experience_label="Dưới 1 năm",
        skills=["CAD/CAM", "CNC", "Engineering", "Technical Drawing"],
        requirements=[
            "Hiểu quy trình CAD/CAM và lập trình máy CNC",
            "Có khả năng đọc bản vẽ kỹ thuật",
            "Sẵn sàng làm việc hybrid và phối hợp đa bộ phận",
        ],
        benefits=["Mô hình hybrid", "Môi trường kỹ thuật ứng dụng", "Cơ hội phát triển kỹ năng chuyên môn"],
        openings=1,
    ),
    JobSnapshot(
        code="novaon-design-02",
        recruiter_code="novaon",
        title="Nhân Viên Thiết Kế Designer Mỹ Phẩm - Thu Nhập Hấp Dẫn - Đi Làm Ngay",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=None,
        salary_max=None,
        location="Hà Nội",
        experience_label="2 năm",
        skills=["Graphic Design", "Branding", "Adobe Suite", "Packaging"],
        requirements=[
            "Có kinh nghiệm thiết kế ấn phẩm marketing hoặc thương hiệu",
            "Am hiểu thiết kế cho nhóm hàng mỹ phẩm là lợi thế",
            "Có khả năng lên ý tưởng và triển khai nhanh",
        ],
        benefits=["Đi làm ngay", "Thu nhập hấp dẫn", "Môi trường sáng tạo"],
        openings=1,
    ),
    JobSnapshot(
        code="novaon-cnc-03",
        recruiter_code="novaon",
        title="Nhân Viên Lập Trình & Đứng Máy Phay CNC - Lương Up To 20 Triệu - Làm Tại Dĩ An, Bình Dương",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=10_000_000,
        salary_max=20_000_000,
        location="Bình Dương",
        experience_label="1 năm",
        skills=["CNC", "Machine Programming", "Mechanical", "Quality Control"],
        requirements=[
            "Có kinh nghiệm vận hành hoặc lập trình máy phay CNC",
            "Hiểu kiểm soát chất lượng gia công",
            "Tác phong cẩn thận và kỷ luật trong sản xuất",
        ],
        benefits=["Lương tới 20 triệu", "Môi trường sản xuất thực tế", "Ổn định lâu dài"],
        openings=2,
    ),
    JobSnapshot(
        code="novaon-software-04",
        recruiter_code="novaon",
        title="Nhân Viên Kinh Doanh, Tư Vấn Phần Mềm / Sale B2B - Tuyển Nữ (Nghỉ Thứ 7, Chủ Nhật, Thu Nhập 10 - 20M) Tại Hà Nội",
        source_page="https://www.topcv.vn/tim-viec-lam-cong-nghe-thong-tin-cr257",
        salary_min=10_000_000,
        salary_max=20_000_000,
        location="Hà Nội",
        experience_label="Dưới 1 năm",
        skills=["Sales B2B", "Software Consulting", "Lead Generation", "Presentation"],
        requirements=[
            "Có khả năng tư vấn giải pháp phần mềm cho khách hàng doanh nghiệp",
            "Ưu tiên ứng viên có kinh nghiệm sale B2B hoặc telesales",
            "Có tinh thần bám đuổi doanh số",
        ],
        benefits=["Nghỉ thứ 7 và chủ nhật", "Thu nhập 10-20 triệu", "Đào tạo bài bản"],
        openings=2,
    ),
    JobSnapshot(
        code="novaon-growth-05",
        recruiter_code="novaon",
        title="Business Development Executive (B2B/Sapo Enterprise) - Lương Cứng Thỏa Thuận, Thu Nhập Upto 40 Triệu, Open Fresher",
        source_page="https://www.topcv.vn/brand/sapovn?id=11698",
        salary_min=15_000_000,
        salary_max=40_000_000,
        location="Hà Nội",
        experience_label="Dưới 1 năm",
        skills=["Business Development", "B2B", "Pipeline", "Prospecting"],
        requirements=[
            "Sẵn sàng học nhanh về giải pháp số cho doanh nghiệp",
            "Có kỹ năng giao tiếp và phát triển khách hàng mới",
            "Open Fresher nhưng có định hướng kinh doanh công nghệ rõ ràng",
        ],
        benefits=["Thu nhập tới 40 triệu", "Lương cứng thỏa thuận", "Open Fresher"],
        openings=2,
    ),
]


def sh(cmd: list[str], *, env: dict[str, str] | None = None) -> str:
    result = subprocess.run(
        cmd,
        cwd=ROOT,
        env=env,
        check=True,
        text=True,
        capture_output=True,
    )
    return result.stdout.strip()


def parse_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value
    return env


def ensure_dirs() -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def slugify(text: str) -> str:
    lowered = text.lower()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    return lowered.strip("-")


def infer_content_type(path: Path) -> str:
    content_type, _ = mimetypes.guess_type(path.name)
    return content_type or "application/octet-stream"


def download_file(url: str, destination: Path) -> None:
    sh(
        [
            "curl",
            "-L",
            "--fail",
            "--silent",
            "--show-error",
            url,
            "-o",
            str(destination),
        ]
    )


def upload_to_s3(local_path: Path, s3_key: str, env: dict[str, str]) -> str:
    region = env["AWS_REGION"]
    bucket = env["AWS_S3_BUCKET_NAME"]
    access_key = env["AWS_ACCESS_KEY_ID"]
    secret_key = env["AWS_SECRET_ACCESS_KEY"]
    content_type = infer_content_type(local_path)
    endpoint = f"https://{bucket}.s3.{region}.amazonaws.com/{s3_key}"
    sh(
        [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--aws-sigv4",
            f"aws:amz:{region}:s3",
            "--user",
            f"{access_key}:{secret_key}",
            "-X",
            "PUT",
            "-H",
            f"Content-Type: {content_type}",
            "--upload-file",
            str(local_path),
            endpoint,
        ]
    )
    return endpoint


def json_sql(value: Any) -> str:
    return sql_string(json.dumps(value, ensure_ascii=False))


def sql_string(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def sql_bool(value: bool) -> str:
    return "TRUE" if value else "FALSE"


def sql_number(value: int | float | None) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def sql_datetime(value: datetime | None) -> str:
    if value is None:
        return "NULL"
    return sql_string(value.strftime("%Y-%m-%d %H:%M:%S"))


def sql_date(value: date | None) -> str:
    if value is None:
        return "NULL"
    return sql_string(value.isoformat())


def experience_to_level(label: str) -> str:
    normalized = label.lower()
    if "dưới 1" in normalized:
        return "JUNIOR"
    if "1 năm" in normalized:
        return "JUNIOR"
    if "2 năm" in normalized or "3 năm" in normalized:
        return "MIDDLE"
    if "4 năm" in normalized or "5 năm" in normalized:
        return "SENIOR"
    return "MIDDLE"


def normalized_title(title: str) -> str:
    title = re.sub(r"\[.*?\]", "", title)
    title = re.sub(r"\s+", " ", title)
    return title.strip(" -")


def build_users() -> list[dict[str, Any]]:
    users = [
        {
            "id": "user-candidate-001",
            "full_name": "Nguyen Minh An",
            "email": "candidate.an@smartcv.seed.local",
            "password": PASSWORD_HASH,
            "phone": "0909001001",
            "verified": True,
            "deleted": False,
            "locked": False,
            "roles": ["CANDIDATE"],
        },
        {
            "id": "user-candidate-002",
            "full_name": "Tran Ha Vy",
            "email": "candidate.vy@smartcv.seed.local",
            "password": PASSWORD_HASH,
            "phone": "0909001002",
            "verified": True,
            "deleted": False,
            "locked": False,
            "roles": ["CANDIDATE"],
        },
        {
            "id": "user-candidate-003",
            "full_name": "Le Duc Huy",
            "email": "candidate.huy@smartcv.seed.local",
            "password": PASSWORD_HASH,
            "phone": "0909001003",
            "verified": True,
            "deleted": False,
            "locked": False,
            "roles": ["CANDIDATE"],
        },
    ]
    for index, recruiter in enumerate(RECRUITERS, start=1):
        users.append(
            {
                "id": f"user-recruiter-{index:03d}",
                "full_name": recruiter.contact_name,
                "email": recruiter.contact_email,
                "password": PASSWORD_HASH,
                "phone": recruiter.contact_phone,
                "verified": True,
                "deleted": False,
                "locked": False,
                "roles": ["RECRUITER"],
            }
        )
    for user in users:
        user["created_at"] = NOW
        user["updated_at"] = NOW
        user["deleted_at"] = None
        user["preferences"] = {}
    return users


def build_candidates() -> list[dict[str, Any]]:
    return [
        {
            "id": "candidate-001",
            "user_id": "user-candidate-001",
            "dob": date(1998, 4, 12),
            "gender": "MALE",
            "address": "Cầu Giấy, Hà Nội",
            "bio": "Backend engineer quan tâm đến Java, Spring Boot và hệ thống phân tán.",
            "title": "Backend Java Developer",
            "avatar_url": None,
            "skills": ["Java", "Spring Boot", "REST API", "MySQL", "Docker"],
            "years_of_experience": 3,
            "job_type": "FULL_TIME",
            "preferred_location": "Hà Nội",
            "expected_salary_min": 18000000,
            "expected_salary_max": 25000000,
            "portfolio_url": None,
            "github_url": "https://github.com/minhan-seed",
            "linkedin_url": "https://www.linkedin.com/in/minhan-seed/",
            "cv_url": None,
            "cvs": [],
            "settings": {"notifications": {}, "privacy": {}},
            "job_suggestions": [],
            "followed_company_ids": [],
            "created_at": NOW,
            "updated_at": NOW,
            "deleted": False,
        },
        {
            "id": "candidate-002",
            "user_id": "user-candidate-002",
            "dob": date(1999, 9, 5),
            "gender": "FEMALE",
            "address": "Thủ Đức, Hồ Chí Minh",
            "bio": "Business analyst định hướng sản phẩm số và thương mại điện tử.",
            "title": "Business Analyst",
            "avatar_url": None,
            "skills": ["Business Analysis", "SQL", "Wireframe", "Agile", "Documentation"],
            "years_of_experience": 2,
            "job_type": "FULL_TIME",
            "preferred_location": "Hồ Chí Minh",
            "expected_salary_min": 16000000,
            "expected_salary_max": 22000000,
            "portfolio_url": None,
            "github_url": None,
            "linkedin_url": "https://www.linkedin.com/in/havy-seed/",
            "cv_url": None,
            "cvs": [],
            "settings": {"notifications": {}, "privacy": {}},
            "job_suggestions": [],
            "followed_company_ids": [],
            "created_at": NOW,
            "updated_at": NOW,
            "deleted": False,
        },
        {
            "id": "candidate-003",
            "user_id": "user-candidate-003",
            "dob": date(2000, 1, 18),
            "gender": "MALE",
            "address": "Thanh Xuân, Hà Nội",
            "bio": "Ứng viên junior yêu thích sales công nghệ và phát triển khách hàng B2B.",
            "title": "Business Development Executive",
            "avatar_url": None,
            "skills": ["B2B Sales", "Lead Generation", "Presentation", "CRM"],
            "years_of_experience": 1,
            "job_type": "FULL_TIME",
            "preferred_location": "Hà Nội",
            "expected_salary_min": 12000000,
            "expected_salary_max": 18000000,
            "portfolio_url": None,
            "github_url": None,
            "linkedin_url": "https://www.linkedin.com/in/duchuy-seed/",
            "cv_url": None,
            "cvs": [],
            "settings": {"notifications": {}, "privacy": {}},
            "job_suggestions": [],
            "followed_company_ids": [],
            "created_at": NOW,
            "updated_at": NOW,
            "deleted": False,
        },
    ]


def build_recruiters(users: list[dict[str, Any]], logo_urls: dict[str, str]) -> list[dict[str, Any]]:
    user_by_recruiter = {
        recruiter.code: users[3 + idx]["id"] for idx, recruiter in enumerate(RECRUITERS)
    }
    rows: list[dict[str, Any]] = []
    for recruiter in RECRUITERS:
        rows.append(
            {
                "id": f"recruiter-{recruiter.code}",
                "user_id": user_by_recruiter[recruiter.code],
                "company_name": recruiter.company_name,
                "company_website": recruiter.company_website,
                "company_address": recruiter.company_address,
                "company_city": recruiter.company_city,
                "company_description": recruiter.company_description,
                "company_phone": recruiter.company_phone,
                "company_size": recruiter.company_size,
                "company_type": recruiter.company_type,
                "founded_year": recruiter.founded_year,
                "industry": recruiter.industry,
                "benefits": recruiter.benefits,
                "rating": recruiter.rating,
                "review_count": recruiter.review_count,
                "logo_url": logo_urls[recruiter.code],
                "cover_image_url": None,
                "tax_code": recruiter.tax_code,
                "business_license_url": None,
                "linkedin_url": recruiter.linkedin_url,
                "facebook_url": recruiter.facebook_url,
                "contact_name": recruiter.contact_name,
                "contact_email": recruiter.contact_email,
                "contact_phone": recruiter.contact_phone,
                "status": recruiter.status,
                "rejection_note": None,
                "quota_job_post": 10,
                "quota_cv_views": 50 if recruiter.status == "APPROVED" else 10,
                "created_at": NOW,
                "updated_at": NOW,
                "deleted": False,
                "source_page": recruiter.source_page,
            }
        )
    return rows


def build_jobs(recruiters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recruiter_by_code = {row["id"].replace("recruiter-", ""): row for row in recruiters}
    jobs: list[dict[str, Any]] = []
    for index, job in enumerate(JOBS, start=1):
        recruiter = recruiter_by_code[job.recruiter_code]
        jobs.append(
            {
                "id": f"job-{index:03d}",
                "recruiter_id": recruiter["id"],
                "title": job.title,
                "normalized_title": normalized_title(job.title),
                "description": (
                    f"Tin tuyển dụng được seed từ snapshot TopCV cho vị trí '{normalized_title(job.title)}'. "
                    f"Job này được gắn với recruiter '{recruiter['company_name']}' để phục vụ dữ liệu demo "
                    "cho luồng recruiter/job của SmartCV."
                ),
                "company": recruiter["company_name"],
                "location": job.location,
                "salary_min": job.salary_min,
                "salary_max": job.salary_max,
                "job_type": "FULL_TIME",
                "experience_level": experience_to_level(job.experience_label),
                "skills": job.skills,
                "requirements": job.requirements,
                "benefits": job.benefits,
                "moderation_status": "PUBLISHED",
                "visibility_status": "ACTIVE",
                "moderation_note": None,
                "reviewed_by": "admin-seed",
                "reviewed_at": NOW,
                "deadline": JOB_DEADLINE,
                "openings": job.openings,
                "qualified_threshold": 70,
                "reject_threshold": 40,
                "auto_reject_enabled": False,
                "required_test": None,
                "deleted": False,
                "created_at": NOW + timedelta(minutes=index),
                "updated_at": NOW + timedelta(minutes=index),
                "source_page": job.source_page,
            }
        )
    return jobs


def render_insert(table: str, rows: list[dict[str, Any]], columns: list[str]) -> str:
    lines = [f"INSERT INTO {table} ({', '.join(columns)}) VALUES"]
    values_sql: list[str] = []
    for row in rows:
        rendered: list[str] = []
        for column in columns:
            value = row[column]
            if isinstance(value, bool):
                rendered.append(sql_bool(value))
            elif isinstance(value, (int, float)) or value is None:
                rendered.append(sql_number(value))
            elif isinstance(value, datetime):
                rendered.append(sql_datetime(value))
            elif isinstance(value, date):
                rendered.append(sql_date(value))
            elif isinstance(value, (list, dict)):
                rendered.append(json_sql(value))
            else:
                rendered.append(sql_string(str(value)))
        values_sql.append("  (" + ", ".join(rendered) + ")")
    lines.append(",\n".join(values_sql) + ";")
    return "\n".join(lines)


def write_sql(users: list[dict[str, Any]], candidates: list[dict[str, Any]], recruiters: list[dict[str, Any]], jobs: list[dict[str, Any]]) -> None:
    header = """-- SmartCV seed snapshot generated from TopCV recruiter/job data
-- Storage note:
--   The current SmartCV codebase stores users/candidates/recruiters/jobs in MongoDB collections.
--   This file is emitted as SQL text because the task explicitly requested seed SQL output.
-- Source note:
--   Recruiter/job source content was curated from browser-rendered TopCV pages because
--   direct headless HTTP crawling is blocked by Cloudflare in this environment.
"""
    users_sql = render_insert(
        "users",
        users,
        [
            "id",
            "full_name",
            "email",
            "password",
            "phone",
            "created_at",
            "updated_at",
            "deleted_at",
            "verified",
            "deleted",
            "locked",
            "preferences",
            "roles",
        ],
    )
    candidates_sql = render_insert(
        "candidates",
        candidates,
        [
            "id",
            "user_id",
            "dob",
            "gender",
            "address",
            "bio",
            "title",
            "avatar_url",
            "skills",
            "years_of_experience",
            "job_type",
            "preferred_location",
            "expected_salary_min",
            "expected_salary_max",
            "portfolio_url",
            "github_url",
            "linkedin_url",
            "cv_url",
            "cvs",
            "settings",
            "job_suggestions",
            "followed_company_ids",
            "created_at",
            "updated_at",
            "deleted",
        ],
    )
    recruiters_sql = render_insert(
        "recruiters",
        recruiters,
        [
            "id",
            "user_id",
            "company_name",
            "company_website",
            "company_address",
            "company_city",
            "company_description",
            "company_phone",
            "company_size",
            "company_type",
            "founded_year",
            "industry",
            "benefits",
            "rating",
            "review_count",
            "logo_url",
            "cover_image_url",
            "tax_code",
            "business_license_url",
            "linkedin_url",
            "facebook_url",
            "contact_name",
            "contact_email",
            "contact_phone",
            "status",
            "rejection_note",
            "quota_job_post",
            "quota_cv_views",
            "created_at",
            "updated_at",
            "deleted",
            "source_page",
        ],
    )
    jobs_sql = render_insert(
        "jobs",
        jobs,
        [
            "id",
            "recruiter_id",
            "title",
            "normalized_title",
            "description",
            "company",
            "location",
            "salary_min",
            "salary_max",
            "job_type",
            "experience_level",
            "skills",
            "requirements",
            "benefits",
            "moderation_status",
            "visibility_status",
            "moderation_note",
            "reviewed_by",
            "reviewed_at",
            "deadline",
            "openings",
            "qualified_threshold",
            "reject_threshold",
            "auto_reject_enabled",
            "required_test",
            "deleted",
            "created_at",
            "updated_at",
            "source_page",
        ],
    )
    SQL_FILE.write_text(
        "\n\n".join([header.strip(), users_sql, candidates_sql, recruiters_sql, jobs_sql]) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    ensure_dirs()
    env = parse_env_file(ENV_FILE)

    required_env = [
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_REGION",
        "AWS_S3_BUCKET_NAME",
    ]
    missing = [key for key in required_env if not env.get(key)]
    if missing:
        raise SystemExit(f"Missing required S3 env vars: {', '.join(missing)}")

    logo_urls: dict[str, str] = {}
    for recruiter in RECRUITERS:
        ext = Path(recruiter.logo_source_url).suffix or ".jpg"
        image_path = IMAGES_DIR / f"{recruiter.code}{ext}"
        download_file(recruiter.logo_source_url, image_path)
        s3_key = f"avatars/{recruiter.code}/{image_path.name}"
        logo_urls[recruiter.code] = upload_to_s3(image_path, s3_key, env)

    users = build_users()
    candidates = build_candidates()
    recruiters = build_recruiters(users, logo_urls)
    jobs = build_jobs(recruiters)
    write_sql(users, candidates, recruiters, jobs)

    print(f"Wrote {SQL_FILE.relative_to(ROOT)}")
    print(f"Downloaded {len(RECRUITERS)} logos into {IMAGES_DIR.relative_to(ROOT)}")
    print(f"Generated {len(users)} users, {len(candidates)} candidates, {len(recruiters)} recruiters, {len(jobs)} jobs")


if __name__ == "__main__":
    main()
