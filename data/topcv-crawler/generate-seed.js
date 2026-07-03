const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { chromium } = require('./node_modules/playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(ROOT, 'data', 'topcv-seed');
const TMP_DIR = path.join(ROOT, 'data', 'topcv-crawler', 'tmp');
const ENV_FILE = path.join(ROOT, 'backend', '.env');
const TARGET_COMPANY_COUNT = 25;
const APPROVED_COMPANY_COUNT = 20;
const PENDING_COMPANY_COUNT = TARGET_COMPANY_COUNT - APPROVED_COMPANY_COUNT;
const RAW_COMPANY_LINK_TARGET = 150;
const MAX_LIST_PAGES = 12;
const CANDIDATE_COUNT = 10;
const NOW = new Date('2026-06-27T10:00:00+07:00');
const PASSWORD_HASH = '$2a$10$mGl6Qnn6RPj5sCcQojIFj.yvBtWF88/whqo57Hllz2XcbZUO1Rx5.';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readEnv(filePath) {
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function fail(message) {
  throw new Error(message);
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

function uuid() {
  return crypto.randomUUID();
}

function slugify(value) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

function isoDate(date) {
  return { $date: new Date(date).toISOString() };
}

function localDate(year, month, day) {
  return { $date: new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString() };
}

function localDateFromValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return localDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function textList(items) {
  return Array.from(new Set((items || []).map((item) => normalizeWhitespace(item)).filter(Boolean)));
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function pickWebsite(urls) {
  return (
    (urls || []).find(
      (entry) =>
        entry &&
        /^https?:\/\//i.test(entry) &&
        !/google\.com\/maps|maps\.google|topcv\.vn/i.test(entry),
    ) || null
  );
}

function inferCompanyType(industryText) {
  const text = normalizeWhitespace(industryText).toLowerCase();
  if (/ngân hàng|tài chính|bank|insurance|bảo hiểm|fintech/.test(text)) return 'FINTECH';
  if (/phần mềm|công nghệ thông tin|it|software|saas/.test(text)) return 'PRODUCT_COMPANY';
  if (/marketing|truyền thông|media/.test(text)) return 'AGENCY';
  if (/bất động sản|real estate/.test(text)) return 'ENTERPRISE';
  if (/manufactur|sản xuất|factory|industrial/.test(text)) return 'MANUFACTURING';
  if (/retail|bán lẻ|fmcg|thương mại/.test(text)) return 'DISTRIBUTOR';
  return 'ENTERPRISE';
}

function inferJobCategory(text) {
  const value = normalizeWhitespace(text).toLowerCase();
  if (/phần mềm|công nghệ thông tin|it|software|developer|java|react|backend|frontend/.test(value)) {
    return 'IT_SOFTWARE';
  }
  if (/ngân hàng|tài chính|bank|finance|kế toán/.test(value)) return 'FINANCE_BANKING';
  if (/marketing|seo|content|brand/.test(value)) return 'MARKETING';
  if (/bán lẻ|retail|sales|kinh doanh/.test(value)) return 'RETAIL';
  if (/nhân sự|recruit/.test(value)) return 'HUMAN_RESOURCES';
  if (/logistics|vận tải|transport/.test(value)) return 'TRANSPORTATION';
  if (/du lịch|khách sạn|hospitality/.test(value)) return 'HOSPITALITY_TOURISM';
  if (/giáo dục|education/.test(value)) return 'EDUCATION';
  if (/y tế|healthcare|medical/.test(value)) return 'HEALTHCARE';
  if (/sản xuất|manufactur|factory/.test(value)) return 'MANUFACTURING';
  return 'IT_SOFTWARE';
}

function inferExperienceLevel(months) {
  const value = Number(months || 0);
  if (value <= 6) return 'INTERN';
  if (value <= 18) return 'JUNIOR';
  if (value <= 42) return 'MIDDLE';
  if (value <= 72) return 'SENIOR';
  return 'LEAD';
}

function inferCity(addressText) {
  const text = normalizeWhitespace(addressText);
  const cities = [
    'Hà Nội',
    'Hồ Chí Minh',
    'Đà Nẵng',
    'Hải Phòng',
    'Bắc Ninh',
    'Thái Nguyên',
    'Bình Dương',
    'Đồng Nai',
    'Cần Thơ',
    'Nha Trang',
  ];
  return cities.find((city) => text.includes(city)) || text.split(',').pop()?.trim() || 'Việt Nam';
}

function synthesizePhone(index) {
  return `0908${String(100000 + index).slice(-6)}`;
}

function synthesizeRecruiterEmail(website, identifier, index) {
  try {
    const url = new URL(website);
    const host = url.hostname.replace(/^www\./, '');
    return `talent+${identifier || index}@${host}`;
  } catch {
    return `recruiter${index}@smartcv.seed.local`;
  }
}

function parseSalaryRange(baseSalary, salaryText) {
  if (baseSalary?.value) {
    const min = Number(baseSalary.value.minValue || 0) || null;
    const max = Number(baseSalary.value.maxValue || 0) || null;
    if (min || max) {
      return { min, max };
    }
  }
  const text = normalizeWhitespace(salaryText);
  const matches = Array.from(text.matchAll(/(\d+(?:[.,]\d+)?)\s*triệu/gi)).map((match) =>
    Math.round(Number(match[1].replace(',', '.')) * 1000000),
  );
  if (matches.length >= 2) {
    return { min: matches[0], max: matches[1] };
  }
  if (matches.length === 1) {
    return { min: matches[0], max: matches[0] };
  }
  return { min: null, max: null };
}

function parseEmployeeSize(numberOfEmployees) {
  if (!numberOfEmployees) return null;
  const minValue = Number(numberOfEmployees.minValue || 0) || null;
  const maxValue = Number(numberOfEmployees.maxValue || 0) || null;
  if (minValue && maxValue) return `${minValue}-${maxValue} nhân viên`;
  if (minValue) return `${minValue}+ nhân viên`;
  return null;
}

function parseIndustry(org) {
  if (Array.isArray(org.knowsAbout) && org.knowsAbout.length) {
    return textList(org.knowsAbout).join(', ');
  }
  return normalizeWhitespace(org.industry || org.description || '');
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname);
    return ext || '.jpg';
  } catch {
    return '.jpg';
  }
}

function shell(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture === false ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    fail(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function downloadFile(url, destination) {
  shell('curl', ['-L', '--fail', '--silent', '--show-error', url, '-o', destination]);
}

function uploadToS3(localPath, key, env) {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET_NAME'];
  for (const name of required) {
    if (!env[name]) fail(`Missing env ${name}`);
  }
  const region = env.AWS_REGION;
  const bucket = env.AWS_S3_BUCKET_NAME;
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  const contentType = key.endsWith('.png') ? 'image/png' : key.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
  shell('curl', [
    '--fail',
    '--silent',
    '--show-error',
    '--aws-sigv4',
    `aws:amz:${region}:s3`,
    '--user',
    `${env.AWS_ACCESS_KEY_ID}:${env.AWS_SECRET_ACCESS_KEY}`,
    '-X',
    'PUT',
    '-H',
    `Content-Type: ${contentType}`,
    '--upload-file',
    localPath,
    url,
  ]);
  return url;
}

function extractJsonLd(blocks, type) {
  for (const raw of blocks || []) {
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of candidates) {
        if (entry?.['@type'] === type) return entry;
        if (entry?.mainEntity?.['@type'] === type) return entry.mainEntity;
      }
    } catch {}
  }
  return null;
}

function extractFirstJsonLd(blocks, acceptedTypes) {
  for (const raw of blocks || []) {
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of candidates) {
        if (acceptedTypes.includes(entry?.['@type'])) return entry;
      }
    } catch {}
  }
  return null;
}

function splitSectionTexts(section) {
  if (!section) return [];
  return textList(
    (section.items || []).map((item) => item.replace(/^[-*•]\s*/, '')),
  );
}

async function createPage(browser) {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'vi-VN',
    viewport: { width: 1440, height: 2600 },
  });
  const page = await context.newPage();
  return { context, page };
}

async function collectCompanyLinks(page) {
  const urls = [];
  let listPage = 1;
  while (urls.length < RAW_COMPANY_LINK_TARGET && listPage <= MAX_LIST_PAGES) {
    const url = listPage === 1 ? 'https://www.topcv.vn/cong-ty' : `https://www.topcv.vn/cong-ty?page=${listPage}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(3000);
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((anchor) => anchor.href)
        .filter((href) => /^https:\/\/www\.topcv\.vn\/cong-ty\/.+\/\d+\.html(\?.*)?$/.test(href))
        .filter((href) => !href.includes('-cid')),
    );
    for (const link of links) {
      if (!urls.includes(link)) {
        urls.push(link.split('?')[0]);
      }
      if (urls.length >= RAW_COMPANY_LINK_TARGET) break;
    }
    listPage += 1;
  }
  if (urls.length < TARGET_COMPANY_COUNT) {
    fail(`Only found ${urls.length} company links`);
  }
  return urls;
}

async function crawlCompany(page, companyUrl) {
  let data = null;
  let org = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(companyUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(3000 + attempt * 1000);
    data = await page.evaluate(() => {
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((node) => node.textContent);
      const meta = {};
      for (const node of document.querySelectorAll('meta[property], meta[name]')) {
        meta[node.getAttribute('property') || node.getAttribute('name')] = node.getAttribute('content');
      }
      const cover =
        document.querySelector('.img-desktop')?.src ||
        document.querySelector('img[src*="cover"]')?.src ||
        null;
      const logo =
        document.querySelector('img[alt*="Bank"], img[alt*="Công ty"], img[alt*="Company"], img[src*="company_logos"]')?.src ||
        meta['og:image'] ||
        null;
      const jobsUrl =
        document.querySelector('a[href*="-cid"][href*="/tuyen-dung"]')?.href ||
        document.querySelector('a[href*="/brand/"][href*="/tuyen-dung"]')?.href ||
        document.querySelector('a[href*="/tuyen-dung.html"]')?.href ||
        null;
      return {
        title: document.title,
        h1: normalize(document.querySelector('h1')?.textContent),
        jsonLd,
        meta,
        cover,
        logo,
        jobsUrl,
        intro: normalize(
          document.querySelector('.company-detail__info-description, .company-detail__company-intro, .company-introduction, .company-description')?.textContent,
        ),
      };
    });
    org = extractJsonLd(data.jsonLd, 'Organization');
    const localBusiness = extractFirstJsonLd(data.jsonLd, ['LocalBusiness', 'Corporation', 'ProfessionalService']);
    if (!org && localBusiness) {
      org = {
        '@type': 'Organization',
        identifier: slugify(companyUrl.split('/').slice(-1)[0]),
        legalName: data.h1 || localBusiness.name,
        name: data.h1 || localBusiness.name,
        description: data.meta.description || localBusiness.description || '',
        address: localBusiness.address || '',
        logo: localBusiness.image || data.meta['og:image'] || data.logo,
        sameAs: [],
        numberOfEmployees: null,
      };
    }
    if (org) break;
  }
  if (!org) {
    org = {
      '@type': 'Organization',
      identifier: slugify(companyUrl.split('/').slice(-1)[0]),
      legalName: data.h1 || data.title,
      name: data.h1 || data.title,
      description: data.meta.description || '',
      address: '',
      logo: data.meta['og:image'] || data.logo,
      sameAs: [],
      numberOfEmployees: null,
    };
  }
  return {
    companyUrl,
    org,
    title: data.title,
    alias: data.h1,
    description: normalizeWhitespace(data.intro || org.description || data.meta.description || ''),
    logoSourceUrl: data.logo || org.logo || data.meta['og:image'] || null,
    coverSourceUrl: data.cover || data.meta['og:image'] || null,
    jobsUrl: data.jobsUrl || org.hasPart?.url || null,
  };
}

async function collectCompanyJobLinks(page, jobsUrl) {
  const urls = [];
  let totalPages = 1;
  for (let current = 1; current <= totalPages; current += 1) {
    const pageUrl = current === 1 ? jobsUrl : `${jobsUrl}${jobsUrl.includes('?') ? '&' : '?'}page=${current}`;
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page
      .waitForSelector('a[href*="/viec-lam/"], a[href*="/brand/"][href*="/tuyen-dung/"]', {
        timeout: 5000,
      })
      .catch(() => {});
    await page.waitForTimeout(2000);
    const result = await page.evaluate(() => {
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const counter =
        normalize(document.querySelector('.job-list-page-suggest .title-box')?.textContent) ||
        normalize(document.body.textContent.match(/\b1\/(\d+)\s*trang\b/i)?.[0]);
      const bodyText = normalize(document.body.textContent);
      const match = bodyText.match(/\b1\/(\d+)\s*trang\b/i);
      const pages = match ? Number(match[1]) : 1;
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((anchor) => anchor.href.split('?')[0])
        .filter((href) =>
          /^https:\/\/www\.topcv\.vn\/viec-lam\/.+\/\d+\.html$/i.test(href) ||
          /^https:\/\/www\.topcv\.vn\/brand\/.+\/tuyen-dung\/.+-j\d+\.html$/i.test(href),
        );
      return { pages, links, counter };
    });
    totalPages = Math.max(totalPages, result.pages || 1);
    for (const link of result.links) {
      if (!urls.includes(link)) {
        urls.push(link);
      }
    }
  }
  return urls;
}

async function crawlJob(page, url) {
  let data = null;
  let posting = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2500 + attempt * 1000);
    data = await page.evaluate(() => {
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((node) => node.textContent);
      const sections = Array.from(document.querySelectorAll('.job-description__item')).map((section) => ({
        heading: normalize(section.querySelector('h3')?.textContent),
        items: Array.from(section.querySelectorAll('li, p')).map((node) => normalize(node.textContent)).filter(Boolean),
      }));
      const salaryText =
        normalize(document.querySelector('[class*="salary"]')?.textContent) ||
        normalize(document.body.textContent.match(/Mức lương[^\n]+/)?.[0]);
      return {
        title: document.title,
        h1: normalize(document.querySelector('h1')?.textContent),
        jsonLd,
        sections,
        salaryText,
      };
    });
    posting = extractJsonLd(data.jsonLd, 'JobPosting');
    if (posting) break;
  }
  if (!posting) {
    fail(`Missing job JSON-LD for ${url}`);
  }
  const sectionMap = new Map();
  for (const section of data.sections) {
    const key = normalizeWhitespace(section.heading).toLowerCase();
    sectionMap.set(key, splitSectionTexts(section));
  }
  const requirements =
    sectionMap.get('yêu cầu ứng viên') ||
    sectionMap.get('yêu cầu công việc') ||
    sectionMap.get('yêu cầu') ||
    [];
  const benefits =
    sectionMap.get('quyền lợi được hưởng') ||
    sectionMap.get('quyền lợi') ||
    [];
  const description =
    sectionMap.get('mô tả công việc') ||
    splitSectionTexts({ items: [normalizeWhitespace(posting.description || '')] });
  return {
    url,
    posting,
    title: data.h1 || posting.title || data.title,
    requirements,
    benefits,
    description,
    salaryText: data.salaryText,
  };
}

function buildRecruiterSeed(company, status, index, assets) {
  const org = company.org;
  const industry = parseIndustry(org);
  const website = pickWebsite(org.sameAs || []) || company.companyUrl;
  const address = normalizeWhitespace(org.address || '');
  const category = inferJobCategory(`${industry} ${company.alias || org.legalName || org.name}`);
  const identifier = org.identifier || slugify(org.legalName || org.name || company.alias);
  const userId = uuid();
  const recruiterId = uuid();
  const email = synthesizeRecruiterEmail(website, slugify(identifier), index + 1);
  const contactName = `${company.alias || org.legalName || org.name} Talent Acquisition`;
  return {
    user: {
      _id: userId,
      full_name: contactName,
      email,
      password: PASSWORD_HASH,
      auth_provider: 'LOCAL',
      google_subject: null,
      phone: synthesizePhone(index + 1),
      avt_image_id: null,
      created_at: isoDate(NOW),
      updated_at: isoDate(NOW),
      deleted_at: null,
      verified: true,
      deleted: false,
      locked: false,
      preferences: {
        language: 'VI',
        theme: 'LIGHT',
      },
      roles: ['RECRUITER'],
    },
    recruiter: {
      _id: recruiterId,
      user_id: userId,
      company_name: normalizeWhitespace(org.legalName || org.name || company.alias),
      company_website: website,
      company_address: address,
      company_city: inferCity(address),
      company_description: company.description,
      company_phone: synthesizePhone(index + 101),
      company_size: parseEmployeeSize(org.numberOfEmployees) || '100-500 nhân viên',
      company_type: inferCompanyType(industry),
      founded_year: Number(org.foundingDate || 0) || null,
      industry,
      category,
      benefits: [],
      rating: null,
      review_count: null,
      logo_url: assets.logoUrl,
      cover_image_url: assets.coverUrl,
      tax_code: org.taxID || null,
      business_license_url: null,
      linkedin_url: null,
      facebook_url: null,
      contact_name: contactName,
      contact_email: email,
      contact_phone: synthesizePhone(index + 1),
      status,
      rejection_note: status === 'PENDING' ? 'Chờ admin phê duyệt hồ sơ doanh nghiệp seed.' : null,
      quota_job_post: status === 'APPROVED' ? 50 : 5,
      quota_cv_views: status === 'APPROVED' ? 200 : 20,
      active_package_id: null,
      package_activated_at: null,
      package_expires_at: null,
      last_payment_order_id: null,
      platform_fee_due_at: null,
      platform_fee_last_paid_at: null,
      platform_fee_reminder_sent_at: null,
      platform_fee_overdue_sent_at: null,
      platform_fee_locked_at: null,
      package_expiry_warning_sent_at: null,
      package_downgraded_at: null,
      post_expiry_cleanup_at: null,
      monthly_ai_credits_used: 0,
      monthly_ai_credits_month: null,
      created_at: isoDate(NOW),
      updated_at: isoDate(NOW),
      deleted: false,
      deleted_at: null,
    },
  };
}

function buildJobSeed(job, recruiter) {
  const posting = job.posting;
  const salary = parseSalaryRange(posting.baseSalary, job.salaryText);
  const months = posting.experienceRequirements?.monthsOfExperience || 0;
  const address = posting.jobLocation?.address || {};
  const location = textList([address.streetAddress, address.addressLocality, address.addressRegion]).join(', ');
  return {
    _id: uuid(),
    recruiter_id: recruiter._id,
    title: normalizeWhitespace(job.title),
    normalized_title: normalizeWhitespace(job.title),
    description: normalizeWhitespace(job.description.join(' ')),
    company: recruiter.company_name,
    location,
    salary_min: salary.min,
    salary_max: salary.max,
    jobType: posting.employmentType === 'PART_TIME' ? 'PART_TIME' : 'FULL_TIME',
    experienceLevel: inferExperienceLevel(months),
    skills: textList(String(posting.skills || '').split(',')),
    requirements: job.requirements,
    benefits: job.benefits,
    moderation_status: 'PUBLISHED',
    visibility_status: 'ACTIVE',
    moderationNote: null,
    reviewedBy: 'seed-admin',
    reviewedAt: isoDate(NOW),
    deadline: localDateFromValue(posting.validThrough || NOW),
    openings: Number(posting.totalJobOpenings || 1) || 1,
    qualifiedThreshold: 70,
    rejectThreshold: 40,
    autoRejectEnabled: false,
    requiredTest: null,
    category: inferJobCategory(`${posting.industry || ''} ${job.title}`),
    deleted: false,
    deletedAt: null,
    createdAt: isoDate(posting.datePosted || NOW),
    updatedAt: isoDate(NOW),
  };
}

function buildCandidateSeeds() {
  const firstNames = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Khánh', 'Linh', 'Minh', 'Ngọc'];
  const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Phan'];
  const titles = [
    'Backend Developer',
    'Frontend Developer',
    'Business Analyst',
    'QA Engineer',
    'Product Designer',
    'Data Analyst',
    'Mobile Developer',
    'DevOps Engineer',
    'Technical Recruiter',
    'Project Coordinator',
  ];
  const locations = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'];
  const candidates = [];
  for (let i = 0; i < CANDIDATE_COUNT; i += 1) {
    const fullName = `${lastNames[i % lastNames.length]} ${firstNames[i % firstNames.length]} ${String.fromCharCode(65 + i)}`;
    const userId = uuid();
    candidates.push({
      user: {
        _id: userId,
        full_name: fullName,
        email: `candidate${i + 1}@smartcv.seed.local`,
        password: PASSWORD_HASH,
        auth_provider: 'LOCAL',
        google_subject: null,
        phone: `0911${String(100000 + i).slice(-6)}`,
        avt_image_id: null,
        created_at: isoDate(NOW),
        updated_at: isoDate(NOW),
        deleted_at: null,
        verified: true,
        deleted: false,
        locked: false,
        preferences: {
          language: 'VI',
          theme: 'LIGHT',
        },
        roles: ['CANDIDATE'],
      },
      candidate: {
        _id: uuid(),
        user_id: userId,
        dob: localDate(1995 + (i % 8), (i % 12) + 1, ((i * 2) % 27) + 1),
        gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
        address: `${locations[i % locations.length]}, Việt Nam`,
        bio: `${titles[i]} đang tìm kiếm cơ hội phát triển trong môi trường sản phẩm và tăng trưởng.`,
        title: titles[i],
        avatar_url: null,
        skills: textList(
          [
            ['Java', 'Spring Boot', 'REST API', 'MySQL'],
            ['React', 'TypeScript', 'HTML', 'CSS'],
            ['SQL', 'Documentation', 'Agile', 'Stakeholder Management'],
            ['Automation Testing', 'Selenium', 'Postman', 'API Testing'],
            ['Figma', 'Design System', 'UX Research', 'Prototype'],
          ][i % 5],
        ),
        years_of_experience: 1 + (i % 5),
        experiences: [],
        educations: [],
        certifications: [],
        languages: [],
        job_type: 'FULL_TIME',
        preferred_location: locations[i % locations.length],
        expected_salary_min: 10000000 + i * 1000000,
        expected_salary_max: 16000000 + i * 1200000,
        portfolio_url: null,
        github_url: i % 3 === 0 ? `https://github.com/seed-candidate-${i + 1}` : null,
        linkedin_url: `https://www.linkedin.com/in/seed-candidate-${i + 1}/`,
        cv_url: null,
        cvs: [],
        settings: {
          notifications: {
            emailApplicationUpdates: true,
            emailJobSuggestions: true,
            pushNotifications: true,
            marketingEmails: false,
          },
          privacy: {
            profileVisibility: 'RECRUITERS_ONLY',
            showCvToRecruiters: true,
            showContactInfo: false,
          },
          preferences: {
            language: 'VI',
            theme: 'LIGHT',
          },
        },
        job_suggestions: [],
        suggestions_updated_at: null,
        followed_company_ids: [],
        active_package_id: null,
        package_activated_at: null,
        package_expires_at: null,
        last_payment_order_id: null,
        package_expiry_warning_sent_at: null,
        package_downgraded_at: null,
        post_expiry_cleanup_at: null,
        monthly_ai_credits_used: 0,
        monthly_ai_credits_month: null,
        created_at: isoDate(NOW),
        updated_at: isoDate(NOW),
        deleted: false,
        deleted_at: null,
      },
    });
  }
  return candidates;
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), JSON.stringify(payload, null, 2));
}

async function main() {
  ensureDir(OUTPUT_DIR);
  ensureDir(TMP_DIR);
  const env = readEnv(ENV_FILE);
  const browser = await chromium.launch({ headless: true });
  const listingPageState = await createPage(browser);
  const jobPageState = await createPage(browser);

  try {
    log('Collecting company links...');
    const companyLinks = await collectCompanyLinks(listingPageState.page);

    const roles = [
      { _id: 'ADMIN', description: 'Administrator', permissions: [] },
      { _id: 'RECRUITER', description: 'Recruiter', permissions: [] },
      { _id: 'CANDIDATE', description: 'Candidate', permissions: [] },
    ];

    const users = [];
    const recruiters = [];
    const jobs = [];
    const candidateSeeds = buildCandidateSeeds();
    const crawlMeta = [];

    for (const item of candidateSeeds) {
      users.push(item.user);
    }

    let selectedApproved = 0;
    let selectedPending = 0;

    for (let index = 0; index < companyLinks.length; index += 1) {
      if (selectedApproved >= APPROVED_COMPANY_COUNT && selectedPending >= PENDING_COMPANY_COUNT) {
        break;
      }
      const companyUrl = companyLinks[index];
      log(`Crawling company ${index + 1}/${companyLinks.length}: ${companyUrl}`);
      const companyState = await createPage(browser);
      const company = await crawlCompany(companyState.page, companyUrl);
      await companyState.context.close();
      const jobsUrl = company.jobsUrl || company.org.hasPart?.url;
      const companyJobUrls =
        selectedApproved < APPROVED_COMPANY_COUNT && jobsUrl
          ? await collectCompanyJobLinks(jobPageState.page, jobsUrl)
          : [];

      const desiredStatus =
        selectedApproved < APPROVED_COMPANY_COUNT && companyJobUrls.length > 0
          ? 'APPROVED'
          : selectedApproved >= APPROVED_COMPANY_COUNT && selectedPending < PENDING_COMPANY_COUNT
            ? 'PENDING'
            : null;

      if (!desiredStatus) {
        crawlMeta.push({
          company_name: normalizeWhitespace(company.org.legalName || company.org.name || company.alias),
          company_url: companyUrl,
          jobs_url: jobsUrl,
          approved: false,
          selected: false,
          skip_reason:
            selectedApproved < APPROVED_COMPANY_COUNT
              ? 'No public jobs found for approved company slot'
              : 'Target company counts already satisfied',
          crawled_jobs: companyJobUrls.length,
          logo_source_url: company.logoSourceUrl,
          cover_source_url: company.coverSourceUrl,
        });
        continue;
      }

      const logoTmp = path.join(TMP_DIR, `${slugify(company.alias || company.org.name || `company-${index + 1}`)}-logo${extFromUrl(company.logoSourceUrl)}`);
      const coverTmp = path.join(TMP_DIR, `${slugify(company.alias || company.org.name || `company-${index + 1}`)}-cover${extFromUrl(company.coverSourceUrl || company.logoSourceUrl)}`);

      if (!company.logoSourceUrl && company.coverSourceUrl) {
        company.logoSourceUrl = company.coverSourceUrl;
      }
      if (!company.logoSourceUrl) {
        fail(`Missing logo for ${companyUrl}`);
      }

      downloadFile(company.logoSourceUrl, logoTmp);
      const logoKey = `seed/topcv/${slugify(company.alias || company.org.name)}/logo${path.extname(logoTmp) || '.jpg'}`;
      const logoUrl = uploadToS3(logoTmp, logoKey, env);

      let coverUrl = logoUrl;
      if (company.coverSourceUrl) {
        downloadFile(company.coverSourceUrl, coverTmp);
        const coverKey = `seed/topcv/${slugify(company.alias || company.org.name)}/cover${path.extname(coverTmp) || '.jpg'}`;
        coverUrl = uploadToS3(coverTmp, coverKey, env);
      }

      const recruiterSeed = buildRecruiterSeed(company, desiredStatus, recruiters.length, { logoUrl, coverUrl });
      users.push(recruiterSeed.user);
      recruiters.push(recruiterSeed.recruiter);

      if (desiredStatus === 'APPROVED') {
        selectedApproved += 1;
        for (const jobUrl of companyJobUrls) {
          log(`  Job: ${jobUrl}`);
          const singleJobState = await createPage(browser);
          try {
            const job = await crawlJob(singleJobState.page, jobUrl);
            jobs.push(buildJobSeed(job, recruiterSeed.recruiter));
          } finally {
            await singleJobState.context.close();
          }
        }
      } else {
        selectedPending += 1;
      }

      crawlMeta.push({
        company_name: recruiterSeed.recruiter.company_name,
        company_url: companyUrl,
        jobs_url: jobsUrl,
        approved: desiredStatus === 'APPROVED',
        selected: true,
        status: desiredStatus,
        crawled_jobs: companyJobUrls.length,
        logo_source_url: company.logoSourceUrl,
        cover_source_url: company.coverSourceUrl,
        s3_logo_url: logoUrl,
        s3_cover_url: coverUrl,
      });
    }

    if (selectedApproved < APPROVED_COMPANY_COUNT || selectedPending < PENDING_COMPANY_COUNT) {
      fail(
        `Insufficient crawl result: approved=${selectedApproved}/${APPROVED_COMPANY_COUNT}, pending=${selectedPending}/${PENDING_COMPANY_COUNT}`,
      );
    }

    const candidates = candidateSeeds.map((item) => item.candidate);
    const combined = {
      meta: {
        generated_at: new Date().toISOString(),
        companies_total: recruiters.length,
        companies_approved: recruiters.filter((item) => item.status === 'APPROVED').length,
        companies_pending: recruiters.filter((item) => item.status === 'PENDING').length,
        candidate_users: candidates.length,
        recruiter_users: recruiters.length,
        jobs_total: jobs.length,
      },
      role: roles,
      users,
      recruiters,
      candidates,
      jobs,
    };

    writeJson('role.json', roles);
    writeJson('users.json', users);
    writeJson('recruiters.json', recruiters);
    writeJson('candidates.json', candidates);
    writeJson('jobs.json', jobs);
    writeJson('seed.json', combined);
    writeJson('crawl-meta.json', crawlMeta);

    log(`Generated ${recruiters.length} recruiters, ${jobs.length} jobs, ${candidates.length} candidates.`);
    log(`Output: ${OUTPUT_DIR}`);
  } finally {
    await listingPageState.context.close();
    await jobPageState.context.close();
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
