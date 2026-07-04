# Task: Convert O*NET Occupation Data Into Structured Job Requirements

Convert the O*NET occupation payload into the exact JSON schema below.

Rules:

1. Use O*NET as the only source of truth. Do not invent requirements that are not supported by the payload.
2. Prefer concrete technologies from `technologySkills`.
3. Put broad competency items into `mustHaveSkills`.
4. Put bonus or adjacent items into `niceToHaveSkills`.
5. Respect the extracted target role, seniority, and years context from the CV when choosing the strictness of the requirement profile.
6. If a field is unknown, use an empty string, `0`, or an empty array.
7. Return ONLY valid JSON. No markdown. No explanation.

## CV-Derived Target Role

{{TARGET_ROLE}}

## CV-Derived Seniority

{{TARGET_LEVEL}}

## CV-Derived Years Of Experience

{{TARGET_YEARS}}

## O*NET Occupation Payload

{{ONET_JOB_JSON}}

## Output Schema

```json
{
  "jobInfo": {
    "title": "Software Developers",
    "seniorityLevel": "Mid",
    "domain": "Tech",
    "employmentType": "Full-time"
  },
  "requirements": {
    "mustHaveSkills": ["Programming", "Software Development"],
    "niceToHaveSkills": ["Critical Thinking"],
    "mustHaveTools": ["Git"],
    "mustHaveFrameworks": ["Spring Boot"],
    "mustHaveDatabases": ["PostgreSQL"],
    "mustHaveCloud": ["AWS"],
    "mustHaveLanguages": [],
    "mustHaveCertifications": [],
    "minYearsExperience": 3
  },
  "responsibilitySignals": [
    "Develop and test software applications."
  ],
  "screeningQuestions": []
}
```
