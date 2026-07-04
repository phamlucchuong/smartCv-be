# Task: Extract Structured CV Profile

Convert the candidate CV into the exact JSON schema below.

Rules:

1. Extract facts only from the CV. Do not invent experience, skills, certifications, or years.
2. If a field is unknown, use an empty string, `0`, or an empty array.
3. Normalize common synonyms when obvious:
   - ReactJS -> React
   - Golang -> Go
   - Postgres -> PostgreSQL
   - RESTful API -> REST API
4. `yearsOfExperience` should reflect the best estimate from the CV text.
5. `evidenceSkills` must contain skills that are explicitly mentioned or clearly implied by the described work.
6. Return ONLY valid JSON. No markdown. No explanation.

## Candidate CV

{{CV_TEXT}}

## Output Schema

```json
{
  "candidateProfile": {
    "targetRoles": ["Backend Engineer"],
    "seniorityLevel": "Mid",
    "domains": ["FinTech"],
    "yearsOfExperience": 4
  },
  "skills": {
    "technical": ["Java", "Spring Boot", "REST API"],
    "tools": ["Git", "Postman"],
    "frameworks": ["Spring Boot"],
    "databases": ["PostgreSQL"],
    "cloud": ["AWS"],
    "softSkills": ["Team Leadership"],
    "languages": ["English"]
  },
  "experience": [
    {
      "title": "Backend Engineer",
      "company": "ABC Corp",
      "durationMonths": 24,
      "responsibilities": ["Built backend APIs"],
      "achievements": ["Reduced API latency by 20%"],
      "evidenceSkills": ["Java", "Spring Boot", "REST API", "PostgreSQL"]
    }
  ],
  "education": ["BSc Computer Science"],
  "certifications": ["AWS Certified Developer"],
  "projects": [
    {
      "name": "Payments Platform",
      "summary": "Built internal payment APIs",
      "evidenceSkills": ["Java", "Spring Boot", "Docker"]
    }
  ]
}
```
