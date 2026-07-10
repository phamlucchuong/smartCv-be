# Task: Extract Target Job Title from CV

Given the full text of a candidate's CV/resume, identify the primary job title or role
the candidate is targeting.

---

## Candidate CV

{{CV_TEXT}}

---

## Instructions

1. Identify the target role from (in priority order):
   - An explicit "Objective" or "Summary" section
   - The most recent job title in the work history
   - The dominant skill cluster (e.g., mostly Java + Spring → Backend Engineer)

2. Be specific: prefer "Senior Backend Engineer" over "Software Engineer".

3. Output ONLY valid JSON. No markdown. No explanation. No trailing text.

---

## Output Format

```json
{
  "targetPosition": "Senior Backend Software Engineer",
  "targetDomain": "FinTech"
}
```

`targetPosition`: precise job title
`targetDomain`: industry domain (e.g., "FinTech", "E-Commerce", "General Software", "Healthcare")
