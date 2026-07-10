package vn.chuongpl.ai_engine_service.features.analysis;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.chuongpl.ai_engine_service.dtos.response.SkillExtractionResponse;
import vn.chuongpl.ai_engine_service.integration.job.JobSummary;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class StructuredProfileExtractionService {

    private static final Pattern YEARS_PATTERN = Pattern.compile("(\\d{1,2})\\s*\\+?\\s*years?", Pattern.CASE_INSENSITIVE);

    private final AiModelGatewayRouter modelRouter;
    private final PromptBuilder promptBuilder;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public StructuredCvProfile extractCvProfile(String cvText) {
        try {
            String prompt = promptBuilder.buildExtractCvStructuredPrompt(Map.of("CV_TEXT", cvText == null ? "" : cvText));
            StructuredCvProfile parsed = parse(callAi(prompt), StructuredCvProfile.class);
            return sanitizeCvProfile(parsed, cvText);
        } catch (Exception e) {
            log.warn("Structured CV extraction failed, falling back to minimal skill extraction: {}", e.getMessage());
            return fallbackCvProfile(cvText);
        }
    }

    public StructuredJobRequirements extractJobRequirements(JobSummary job) {
        StructuredJobRequirements fallback = fallbackJobRequirements(job);
        try {
            String prompt = promptBuilder.buildExtractJdRequirementsPrompt(Map.of(
                    "JOB_TITLE", safe(job.title()),
                    "EXPERIENCE_LEVEL", safe(job.experienceLevel()),
                    "JOB_SKILLS", String.join(", ", safeList(job.skills())),
                    "JOB_REQUIREMENTS", String.join("\n- ", safeList(job.requirements())),
                    "JOB_DESCRIPTION", safe(job.description())
            ));
            StructuredJobRequirements parsed = parse(callAi(prompt), StructuredJobRequirements.class);
            return mergeJobRequirements(sanitizeJobRequirements(parsed), fallback);
        } catch (Exception e) {
            log.warn("Structured JD extraction failed, using deterministic fallback: {}", e.getMessage());
            return fallback;
        }
    }

    private StructuredCvProfile fallbackCvProfile(String cvText) {
        List<String> extractedSkills = Collections.emptyList();
        try {
            String prompt = promptBuilder.buildExtractSkillsPrompt(Map.of("CV_TEXT", safe(cvText)));
            SkillExtractionResponse response = parse(callAi(prompt), SkillExtractionResponse.class);
            extractedSkills = distinctClean(response.skills());
        } catch (Exception e) {
            log.warn("Fallback skill extraction also failed: {}", e.getMessage());
        }

        StructuredCvProfile.CandidateProfile candidateProfile = new StructuredCvProfile.CandidateProfile(
                Collections.emptyList(),
                inferSeniorityFromYears(inferYearsFromText(cvText)),
                Collections.emptyList(),
                inferYearsFromText(cvText)
        );
        StructuredCvProfile.SkillProfile skillProfile = new StructuredCvProfile.SkillProfile(
                extractedSkills,
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList()
        );
        return new StructuredCvProfile(
                candidateProfile,
                skillProfile,
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList()
        );
    }

    private StructuredJobRequirements fallbackJobRequirements(JobSummary job) {
        int minYears = inferYearsFromText(String.join(" ", safeList(job.requirements())) + " " + safe(job.description()));
        if (minYears == 0) {
            minYears = inferYearsFromExperienceLevel(job.experienceLevel());
        }
        return new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo(
                        safe(job.title()),
                        normalizeSeniority(safe(job.experienceLevel())),
                        inferDomain(safe(job.description())),
                        ""
                ),
                new StructuredJobRequirements.RequirementProfile(
                        distinctClean(job.skills()),
                        extractPreferredSkills(job.requirements()),
                        Collections.emptyList(),
                        Collections.emptyList(),
                        Collections.emptyList(),
                        Collections.emptyList(),
                        Collections.emptyList(),
                        Collections.emptyList(),
                        minYears
                ),
                distinctClean(job.requirements()),
                Collections.emptyList()
        );
    }

    private StructuredCvProfile sanitizeCvProfile(StructuredCvProfile profile, String cvText) {
        StructuredCvProfile.CandidateProfile candidate = profile == null || profile.candidateProfile() == null
                ? new StructuredCvProfile.CandidateProfile(Collections.emptyList(), "", Collections.emptyList(), 0)
                : profile.candidateProfile();
        StructuredCvProfile.SkillProfile skills = profile == null || profile.skills() == null
                ? new StructuredCvProfile.SkillProfile(
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList())
                : profile.skills();

        int years = candidate.yearsOfExperience() > 0 ? candidate.yearsOfExperience() : inferYearsFromText(cvText);
        if (years == 0) {
            years = inferYearsFromExperienceItems(profile == null ? null : profile.experience());
        }

        return new StructuredCvProfile(
                new StructuredCvProfile.CandidateProfile(
                        distinctClean(candidate.targetRoles()),
                        normalizeSeniority(candidate.seniorityLevel().isBlank() ? inferSeniorityFromYears(years) : candidate.seniorityLevel()),
                        distinctClean(candidate.domains()),
                        years
                ),
                new StructuredCvProfile.SkillProfile(
                        distinctClean(skills.technical()),
                        distinctClean(skills.tools()),
                        distinctClean(skills.frameworks()),
                        distinctClean(skills.databases()),
                        distinctClean(skills.cloud()),
                        distinctClean(skills.softSkills()),
                        distinctClean(skills.languages())
                ),
                sanitizeExperience(profile == null ? null : profile.experience()),
                distinctClean(profile == null ? null : profile.education()),
                distinctClean(profile == null ? null : profile.certifications()),
                sanitizeProjects(profile == null ? null : profile.projects())
        );
    }

    private StructuredJobRequirements sanitizeJobRequirements(StructuredJobRequirements requirements) {
        if (requirements == null) {
            return fallbackJobRequirements(new JobSummary("", "", "", "", Collections.emptyList(), Collections.emptyList(), ""));
        }
        StructuredJobRequirements.JobInfo info = requirements.jobInfo() == null
                ? new StructuredJobRequirements.JobInfo("", "", "", "")
                : requirements.jobInfo();
        StructuredJobRequirements.RequirementProfile req = requirements.requirements() == null
                ? new StructuredJobRequirements.RequirementProfile(
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList(), Collections.emptyList(),
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList(), Collections.emptyList(), 0)
                : requirements.requirements();
        return new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo(
                        safe(info.title()),
                        normalizeSeniority(info.seniorityLevel()),
                        safe(info.domain()),
                        safe(info.employmentType())
                ),
                new StructuredJobRequirements.RequirementProfile(
                        distinctClean(req.mustHaveSkills()),
                        distinctClean(req.niceToHaveSkills()),
                        distinctClean(req.mustHaveTools()),
                        distinctClean(req.mustHaveFrameworks()),
                        distinctClean(req.mustHaveDatabases()),
                        distinctClean(req.mustHaveCloud()),
                        distinctClean(req.mustHaveLanguages()),
                        distinctClean(req.mustHaveCertifications()),
                        Math.max(req.minYearsExperience(), 0)
                ),
                distinctClean(requirements.responsibilitySignals()),
                distinctClean(requirements.screeningQuestions())
        );
    }

    private StructuredJobRequirements mergeJobRequirements(StructuredJobRequirements parsed, StructuredJobRequirements fallback) {
        StructuredJobRequirements.JobInfo parsedInfo = parsed.jobInfo();
        StructuredJobRequirements.JobInfo fallbackInfo = fallback.jobInfo();
        StructuredJobRequirements.RequirementProfile parsedReq = parsed.requirements();
        StructuredJobRequirements.RequirementProfile fallbackReq = fallback.requirements();

        return new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo(
                        firstNonBlank(parsedInfo.title(), fallbackInfo.title()),
                        firstNonBlank(parsedInfo.seniorityLevel(), fallbackInfo.seniorityLevel()),
                        firstNonBlank(parsedInfo.domain(), fallbackInfo.domain()),
                        firstNonBlank(parsedInfo.employmentType(), fallbackInfo.employmentType())
                ),
                new StructuredJobRequirements.RequirementProfile(
                        preferNonEmpty(parsedReq.mustHaveSkills(), fallbackReq.mustHaveSkills()),
                        parsedReq.niceToHaveSkills(),
                        parsedReq.mustHaveTools(),
                        parsedReq.mustHaveFrameworks(),
                        parsedReq.mustHaveDatabases(),
                        parsedReq.mustHaveCloud(),
                        parsedReq.mustHaveLanguages(),
                        parsedReq.mustHaveCertifications(),
                        parsedReq.minYearsExperience() > 0 ? parsedReq.minYearsExperience() : fallbackReq.minYearsExperience()
                ),
                preferNonEmpty(parsed.responsibilitySignals(), fallback.responsibilitySignals()),
                parsed.screeningQuestions()
        );
    }

    private List<StructuredCvProfile.ExperienceItem> sanitizeExperience(List<StructuredCvProfile.ExperienceItem> items) {
        if (items == null) {
            return Collections.emptyList();
        }
        List<StructuredCvProfile.ExperienceItem> sanitized = new ArrayList<>();
        for (StructuredCvProfile.ExperienceItem item : items) {
            if (item == null) {
                continue;
            }
            sanitized.add(new StructuredCvProfile.ExperienceItem(
                    safe(item.title()),
                    safe(item.company()),
                    Math.max(item.durationMonths(), 0),
                    distinctClean(item.responsibilities()),
                    distinctClean(item.achievements()),
                    distinctClean(item.evidenceSkills())
            ));
        }
        return sanitized;
    }

    private List<StructuredCvProfile.ProjectItem> sanitizeProjects(List<StructuredCvProfile.ProjectItem> items) {
        if (items == null) {
            return Collections.emptyList();
        }
        List<StructuredCvProfile.ProjectItem> sanitized = new ArrayList<>();
        for (StructuredCvProfile.ProjectItem item : items) {
            if (item == null) {
                continue;
            }
            sanitized.add(new StructuredCvProfile.ProjectItem(
                    safe(item.name()),
                    safe(item.summary()),
                    distinctClean(item.evidenceSkills())
            ));
        }
        return sanitized;
    }

    private String callAi(String prompt) {
        return modelRouter.call(promptBuilder.systemPrompt(), prompt);
    }

    private <T> T parse(String raw, Class<T> clazz) throws Exception {
        return mapper.readValue(extractJson(raw), clazz);
    }

    private String extractJson(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
            trimmed = trimmed.replaceFirst("^```json", "").replaceFirst("^```", "");
            trimmed = trimmed.substring(0, trimmed.lastIndexOf("```"));
        }
        String candidate = trimmed.trim();
        int objectStart = candidate.indexOf('{');
        int objectEnd = candidate.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) {
            return candidate.substring(objectStart, objectEnd + 1).trim();
        }
        return candidate;
    }

    private List<String> extractPreferredSkills(List<String> requirements) {
        if (requirements == null) {
            return Collections.emptyList();
        }
        List<String> preferred = new ArrayList<>();
        for (String requirement : requirements) {
            String value = safe(requirement).toLowerCase();
            if (value.contains("nice to have") || value.contains("preferred") || value.contains("plus")) {
                preferred.add(requirement.trim());
            }
        }
        return distinctClean(preferred);
    }

    private String inferDomain(String description) {
        String text = safe(description).toLowerCase();
        if (text.contains("fintech") || text.contains("payment") || text.contains("bank")) return "FinTech";
        if (text.contains("e-commerce") || text.contains("ecommerce") || text.contains("marketplace")) return "E-Commerce";
        if (text.contains("health") || text.contains("medical")) return "Healthcare";
        if (text.contains("education") || text.contains("edtech")) return "Education";
        return "";
    }

    private int inferYearsFromText(String text) {
        Matcher matcher = YEARS_PATTERN.matcher(safe(text));
        int maxYears = 0;
        while (matcher.find()) {
            maxYears = Math.max(maxYears, Integer.parseInt(matcher.group(1)));
        }
        return maxYears;
    }

    private int inferYearsFromExperienceItems(List<StructuredCvProfile.ExperienceItem> items) {
        if (items == null || items.isEmpty()) {
            return 0;
        }
        int months = items.stream().mapToInt(StructuredCvProfile.ExperienceItem::durationMonths).sum();
        return months <= 0 ? 0 : Math.max(1, months / 12);
    }

    private int inferYearsFromExperienceLevel(String experienceLevel) {
        String value = normalizeSeniority(experienceLevel).toLowerCase();
        return switch (value) {
            case "intern" -> 0;
            case "junior" -> 1;
            case "mid" -> 3;
            case "senior" -> 5;
            case "lead", "manager" -> 7;
            default -> 0;
        };
    }

    private String inferSeniorityFromYears(int years) {
        if (years >= 7) return "Lead";
        if (years >= 5) return "Senior";
        if (years >= 2) return "Mid";
        if (years >= 1) return "Junior";
        return "Intern";
    }

    private String normalizeSeniority(String value) {
        String normalized = safe(value).trim().toLowerCase();
        if (normalized.contains("intern")) return "Intern";
        if (normalized.contains("junior") || normalized.contains("fresher") || normalized.contains("entry")) return "Junior";
        if (normalized.contains("mid")) return "Mid";
        if (normalized.contains("senior") || normalized.contains("sr")) return "Senior";
        if (normalized.contains("lead") || normalized.contains("principal")) return "Lead";
        if (normalized.contains("manager")) return "Manager";
        return safe(value).trim();
    }

    private List<String> distinctClean(List<String> values) {
        if (values == null) {
            return Collections.emptyList();
        }
        Set<String> deduped = new LinkedHashSet<>();
        for (String value : values) {
            String cleaned = safe(value).trim();
            if (!cleaned.isBlank()) {
                deduped.add(cleaned);
            }
        }
        return List.copyOf(deduped);
    }

    private List<String> safeList(List<String> values) {
        return values == null ? Collections.emptyList() : values;
    }

    private List<String> preferNonEmpty(List<String> primary, List<String> fallback) {
        return primary == null || primary.isEmpty() ? fallback : primary;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String firstNonBlank(String primary, String fallback) {
        return safe(primary).isBlank() ? safe(fallback) : primary;
    }
}
