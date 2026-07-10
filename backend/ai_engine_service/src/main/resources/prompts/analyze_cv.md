# Task: Analyze CV against Job Description

Evaluate the candidate's CV against the target job and return a structured analysis.

---

## Job Details

**Title:** {{JOB_TITLE}}
**Experience Level Required:** {{EXPERIENCE_LEVEL}}

**Job Description:**
{{JOB_DESCRIPTION}}

**Required Skills:**
{{JOB_SKILLS}}

**Requirements:**
- {{JOB_REQUIREMENTS}}

---

## Candidate CV

{{CV_TEXT}}

---

## Instructions

1. Read the CV carefully and identify every skill, technology, tool, and experience the
   candidate demonstrates — either explicitly listed or clearly implied by their work history.

2. Compare this set against the job's required skills and requirements.

3. Classify each skill as:
   - **matched**: present in both CV and job requirements (use near-synonym matching).
   - **missing**: required by the job but absent from the CV.
   - **extra**: present in the CV but not required by this job — genuine value-adds.

4. Calculate `matchScore` (0–100) based on the ratio of matched required skills to total
   required skills, weighted by how critical each requirement appears in the JD. Then adjust
   ±10 points based on years of experience alignment with `experienceLevel`.

5. Write a `summary` (English) of 2–3 sentences that gives the candidate an honest, direct
   assessment of where they stand and what the biggest lever is to improve their match.
   Then write `summaryVi`: the exact same assessment translated to Vietnamese.

6. Set `scoreLabel` based on the score calibration table in the system prompt.

Return ONLY a valid JSON object with these fields (no markdown, no extra text):
{
  "matchScore": 0,
  "scoreLabel": "Fair",
  "matchedSkills": [],
  "missingSkills": [],
  "extraSkills": [],
  "summary": "English summary here.",
  "summaryVi": "Bản dịch tiếng Việt ở đây."
}
