export const JOB_CATEGORY_LABELS: Record<string, string> = {
  IT_SOFTWARE: "IT / Software",
  FINANCE_BANKING: "Finance & Banking",
  MARKETING: "Marketing",
  HEALTHCARE: "Healthcare",
  EDUCATION: "Education",
  MANUFACTURING: "Manufacturing",
  RETAIL: "Retail",
  REAL_ESTATE: "Real Estate",
  TRANSPORTATION: "Transportation",
  MEDIA_ENTERTAINMENT: "Media & Entertainment",
  LEGAL_CONSULTING: "Legal & Consulting",
  HUMAN_RESOURCES: "Human Resources",
  AGRICULTURE: "Agriculture",
  ENERGY_ENVIRONMENT: "Energy & Environment",
  HOSPITALITY_TOURISM: "Hospitality & Tourism",
};

export const JOB_CATEGORY_OPTIONS = Object.entries(JOB_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);
