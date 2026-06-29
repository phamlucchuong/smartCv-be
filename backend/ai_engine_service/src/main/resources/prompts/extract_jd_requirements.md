# Task: Extract Structured Job Requirements

Convert the job description and structured job fields into the exact JSON schema below.

Rules:

1. Extract requirements faithfully. Do not invent skills or minimum years that are not supported.
2. Put strict requirements into `mustHave...` fields.
3. Put preferred or bonus items into `niceToHaveSkills`.
4. Use canonical skill names where obvious:
   - ReactJS -> React
   - Golang -> Go
   - Postgres -> PostgreSQL
   - RESTful services -> REST API
5. If minimum experience is not explicit, use `0`.
6. Return ONLY valid JSON. No markdown. No explanation.

## Job Title

{{JOB_TITLE}}

## Experience Level

{{EXPERIENCE_LEVEL}}

## Explicit Skill List

{{JOB_SKILLS}}

## Requirements

- {{JOB_REQUIREMENTS}}

## Full Description

{{JOB_DESCRIPTION}}

## Output Schema

```json
{
  "jobInfo": {
    "title": "Backend Engineer",
    "seniorityLevel": "Mid",
    "domain": "FinTech",
    "employmentType": "Full-time"
  },
  "requirements": {
    "mustHaveSkills": ["Java", "REST API"],
    "niceToHaveSkills": ["Docker", "Kubernetes"],
    "mustHaveTools": ["Git"],
    "mustHaveFrameworks": ["Spring Boot"],
    "mustHaveDatabases": ["PostgreSQL"],
    "mustHaveCloud": ["AWS"],
    "mustHaveLanguages": ["English"],
    "mustHaveCertifications": [],
    "minYearsExperience": 3
  },
  "responsibilitySignals": [
    "Build backend APIs",
    "Work with relational databases"
  ],
  "screeningQuestions": [
    "How much Java backend experience is required?"
  ]
}
```
