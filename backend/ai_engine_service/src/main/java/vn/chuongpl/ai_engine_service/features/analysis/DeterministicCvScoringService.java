package vn.chuongpl.ai_engine_service.features.analysis;

import org.springframework.stereotype.Service;
import vn.chuongpl.ai_engine_service.dtos.response.CvAnalysisResponse;
import vn.chuongpl.ai_engine_service.dtos.response.ScoreBreakdownResponse;
import vn.chuongpl.ai_engine_service.dtos.response.ScoreEvidenceResponse;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class DeterministicCvScoringService {

    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9+#.]+");

    public CvAnalysisResponse score(StructuredCvProfile cvProfile, StructuredJobRequirements jobRequirements) {
        SkillIndex cvSkills = buildCvSkillIndex(cvProfile);
        RequirementIndex jobIndex = buildRequirementIndex(jobRequirements);

        List<String> matchedMustHave = intersection(jobIndex.mustHaveByNormalized(), cvSkills.byNormalized());
        List<String> missingMustHave = difference(jobIndex.mustHaveByNormalized(), cvSkills.byNormalized());
        List<String> matchedNiceToHave = intersection(jobIndex.niceToHaveByNormalized(), cvSkills.byNormalized());
        List<String> extraSkills = extras(cvSkills.byNormalized(), jobIndex.allRequiredNormalized());

        double mustCoverage = coverage(matchedMustHave.size(), jobIndex.mustHaveByNormalized().size());
        double niceCoverage = coverage(matchedNiceToHave.size(), jobIndex.niceToHaveByNormalized().size());

        int skillScore = clamp((int) Math.round((mustCoverage * 0.82 + niceCoverage * 0.18) * 100));
        int experienceScore = computeExperienceScore(cvProfile, jobRequirements, jobIndex, cvSkills);
        int seniorityScore = computeSeniorityScore(cvProfile, jobRequirements);
        int domainScore = computeDomainScore(cvProfile, jobRequirements);
        int bonusScore = computeBonusScore(cvProfile, jobRequirements, matchedNiceToHave, cvSkills);

        int rawFinalScore = clamp((int) Math.round(
                skillScore * 0.55 +
                experienceScore * 0.20 +
                seniorityScore * 0.10 +
                domainScore * 0.10 +
                bonusScore * 0.05
        ));

        List<String> appliedCaps = new ArrayList<>();
        int finalScore = applyCaps(rawFinalScore, mustCoverage, matchedMustHave, jobRequirements, cvProfile, appliedCaps);

        List<String> concerns = new ArrayList<>();
        if (!missingMustHave.isEmpty()) {
            concerns.add("Missing must-have skills: " + String.join(", ", missingMustHave));
        }
        if (!appliedCaps.isEmpty()) {
            concerns.addAll(appliedCaps);
        }
        if (experienceYears(cvProfile) < minYears(jobRequirements)) {
            concerns.add("Candidate experience is below the stated minimum.");
        }

        List<String> experienceSignals = collectExperienceSignals(cvProfile, jobIndex, cvSkills);
        String yearsSummary = buildYearsSummary(cvProfile, jobRequirements);
        String summary = buildSummary(finalScore, matchedMustHave, missingMustHave, matchedNiceToHave, yearsSummary, appliedCaps);

        return new CvAnalysisResponse(
                finalScore,
                scoreLabel(finalScore),
                matchedMustHave,
                missingMustHave,
                extraSkills,
                summary,
                new ScoreBreakdownResponse(skillScore, experienceScore, seniorityScore, domainScore, bonusScore, List.copyOf(appliedCaps)),
                new ScoreEvidenceResponse(
                        matchedMustHave,
                        missingMustHave,
                        matchedNiceToHave,
                        experienceSignals,
                        yearsSummary,
                        List.copyOf(concerns)
                )
        );
    }

    private int applyCaps(int rawScore, double mustCoverage, List<String> matchedMustHave,
                          StructuredJobRequirements jobRequirements, StructuredCvProfile cvProfile,
                          List<String> appliedCaps) {
        int cappedScore = rawScore;
        int mustCount = buildRequirementIndex(jobRequirements).mustHaveByNormalized().size();
        int minYears = minYears(jobRequirements);
        int candidateYears = experienceYears(cvProfile);

        if (mustCount > 0 && matchedMustHave.isEmpty()) {
            cappedScore = Math.min(cappedScore, 35);
            appliedCaps.add("Score capped at 35 because no must-have requirement was matched.");
        } else if (mustCount >= 3 && mustCoverage < 0.40d) {
            cappedScore = Math.min(cappedScore, 55);
            appliedCaps.add("Score capped at 55 because must-have skill coverage is below 40%.");
        }

        if (minYears > 0 && candidateYears * 2 < minYears) {
            cappedScore = Math.min(cappedScore, 65);
            appliedCaps.add("Score capped at 65 because experience is less than half of the stated minimum.");
        }
        return cappedScore;
    }

    private int computeExperienceScore(StructuredCvProfile cvProfile, StructuredJobRequirements jobRequirements,
                                       RequirementIndex jobIndex, SkillIndex cvSkills) {
        int candidateYears = experienceYears(cvProfile);
        int minYears = minYears(jobRequirements);
        double yearsRatio = minYears <= 0 ? (candidateYears > 0 ? 1.0d : 0.70d) : Math.min(1.0d, candidateYears / (double) minYears);
        double relevantSignals = collectExperienceSignals(cvProfile, jobIndex, cvSkills).size();
        double relevanceRatio = jobIndex.mustHaveByNormalized().isEmpty()
                ? (relevantSignals > 0 ? 1.0d : 0.70d)
                : Math.min(1.0d, relevantSignals / Math.max(1.0d, Math.ceil(jobIndex.mustHaveByNormalized().size() / 2.0d)));
        return clamp((int) Math.round(yearsRatio * 70 + relevanceRatio * 30));
    }

    private int computeSeniorityScore(StructuredCvProfile cvProfile, StructuredJobRequirements jobRequirements) {
        String cvSeniority = normalizeSeniority(cvProfile.candidateProfile() == null ? "" : cvProfile.candidateProfile().seniorityLevel());
        String jdSeniority = normalizeSeniority(jobRequirements.jobInfo() == null ? "" : jobRequirements.jobInfo().seniorityLevel());
        if (jdSeniority.isBlank()) return 100;
        if (cvSeniority.isBlank()) return 60;
        int distance = Math.abs(seniorityRank(cvSeniority) - seniorityRank(jdSeniority));
        return switch (distance) {
            case 0 -> 100;
            case 1 -> 80;
            case 2 -> 55;
            default -> 30;
        };
    }

    private int computeDomainScore(StructuredCvProfile cvProfile, StructuredJobRequirements jobRequirements) {
        Set<String> cvDomains = normalizedSet(cvProfile.candidateProfile() == null ? Collections.emptyList() : cvProfile.candidateProfile().domains());
        String jdDomain = normalizeToken(jobRequirements.jobInfo() == null ? "" : jobRequirements.jobInfo().domain());
        if (jdDomain.isBlank()) return 100;
        if (cvDomains.isEmpty()) return 60;
        return cvDomains.contains(jdDomain) ? 100 : 35;
    }

    private int computeBonusScore(StructuredCvProfile cvProfile, StructuredJobRequirements jobRequirements,
                                  List<String> matchedNiceToHave, SkillIndex cvSkills) {
        StructuredJobRequirements.RequirementProfile req = jobRequirements.requirements();
        int certMatchScore = coverageCount(cvProfile.certifications(), req == null ? Collections.emptyList() : req.mustHaveCertifications());
        int niceCoverageScore = req == null ? 100 : (req.niceToHaveSkills().isEmpty() ? 100 : clamp((int) Math.round(
                (matchedNiceToHave.size() / (double) req.niceToHaveSkills().size()) * 100)));

        boolean hasProjectEvidence = cvProfile.projects() != null && cvProfile.projects().stream()
                .anyMatch(project -> project.evidenceSkills() != null && project.evidenceSkills().stream()
                        .map(this::normalizeToken)
                        .anyMatch(cvSkills.byNormalized()::containsKey));
        int projectSignalScore = hasProjectEvidence ? 100 : 60;
        return clamp((int) Math.round(certMatchScore * 0.4 + niceCoverageScore * 0.4 + projectSignalScore * 0.2));
    }

    private List<String> collectExperienceSignals(StructuredCvProfile cvProfile, RequirementIndex jobIndex, SkillIndex cvSkills) {
        List<String> signals = new ArrayList<>();
        if (cvProfile.experience() != null) {
            for (StructuredCvProfile.ExperienceItem item : cvProfile.experience()) {
                if (item == null) {
                    continue;
                }
                List<String> matched = intersection(jobIndex.mustHaveByNormalized(), skillMap(item.evidenceSkills()));
                if (!matched.isEmpty()) {
                    String title = item.title().isBlank() ? "Experience entry" : item.title();
                    signals.add(title + " shows " + String.join(", ", matched));
                }
            }
        }
        if (signals.isEmpty() && !cvSkills.byNormalized().isEmpty()) {
            List<String> fallback = intersection(jobIndex.mustHaveByNormalized(), cvSkills.byNormalized());
            if (!fallback.isEmpty()) {
                signals.add("CV explicitly lists " + String.join(", ", fallback));
            }
        }
        return signals.size() > 5 ? signals.subList(0, 5) : signals;
    }

    private String buildYearsSummary(StructuredCvProfile cvProfile, StructuredJobRequirements jobRequirements) {
        int candidateYears = experienceYears(cvProfile);
        int minYears = minYears(jobRequirements);
        if (minYears <= 0) {
            return candidateYears > 0
                    ? "Candidate shows about " + candidateYears + " year(s) of experience."
                    : "The job does not state a minimum years-of-experience requirement.";
        }
        return "Candidate shows about " + candidateYears + " year(s) of experience versus a stated minimum of "
                + minYears + " year(s).";
    }

    private String buildSummary(int finalScore, List<String> matchedMustHave, List<String> missingMustHave,
                                List<String> matchedNiceToHave, String yearsSummary, List<String> appliedCaps) {
        StringBuilder summary = new StringBuilder();
        summary.append("Score ").append(finalScore).append("/100. ");
        if (!matchedMustHave.isEmpty()) {
            summary.append("Matched must-have skills: ").append(String.join(", ", matchedMustHave)).append(". ");
        }
        if (!missingMustHave.isEmpty()) {
            summary.append("Missing must-have skills: ").append(String.join(", ", missingMustHave)).append(". ");
        }
        if (!matchedNiceToHave.isEmpty()) {
            summary.append("Nice-to-have coverage includes ").append(String.join(", ", matchedNiceToHave)).append(". ");
        }
        summary.append(yearsSummary).append(' ');
        if (!appliedCaps.isEmpty()) {
            summary.append("Scoring caps applied: ").append(String.join(" ", appliedCaps));
        }
        return summary.toString().trim();
    }

    private SkillIndex buildCvSkillIndex(StructuredCvProfile cvProfile) {
        Map<String, String> byNormalized = new LinkedHashMap<>();
        addSkills(byNormalized, cvProfile.skills() == null ? Collections.emptyList() : cvProfile.skills().technical());
        addSkills(byNormalized, cvProfile.skills() == null ? Collections.emptyList() : cvProfile.skills().tools());
        addSkills(byNormalized, cvProfile.skills() == null ? Collections.emptyList() : cvProfile.skills().frameworks());
        addSkills(byNormalized, cvProfile.skills() == null ? Collections.emptyList() : cvProfile.skills().databases());
        addSkills(byNormalized, cvProfile.skills() == null ? Collections.emptyList() : cvProfile.skills().cloud());
        addSkills(byNormalized, cvProfile.skills() == null ? Collections.emptyList() : cvProfile.skills().languages());

        if (cvProfile.experience() != null) {
            for (StructuredCvProfile.ExperienceItem item : cvProfile.experience()) {
                addSkills(byNormalized, item == null ? Collections.emptyList() : item.evidenceSkills());
            }
        }
        if (cvProfile.projects() != null) {
            for (StructuredCvProfile.ProjectItem project : cvProfile.projects()) {
                addSkills(byNormalized, project == null ? Collections.emptyList() : project.evidenceSkills());
            }
        }
        return new SkillIndex(byNormalized);
    }

    private RequirementIndex buildRequirementIndex(StructuredJobRequirements jobRequirements) {
        StructuredJobRequirements.RequirementProfile req = jobRequirements.requirements();
        Map<String, String> mustHave = new LinkedHashMap<>();
        Map<String, String> niceToHave = new LinkedHashMap<>();
        if (req != null) {
            addSkills(mustHave, req.mustHaveSkills());
            addSkills(mustHave, req.mustHaveTools());
            addSkills(mustHave, req.mustHaveFrameworks());
            addSkills(mustHave, req.mustHaveDatabases());
            addSkills(mustHave, req.mustHaveCloud());
            addSkills(mustHave, req.mustHaveLanguages());
            addSkills(niceToHave, req.niceToHaveSkills());
            addSkills(niceToHave, req.mustHaveCertifications());
        }
        Set<String> allRequired = new LinkedHashSet<>(mustHave.keySet());
        allRequired.addAll(niceToHave.keySet());
        return new RequirementIndex(mustHave, niceToHave, allRequired);
    }

    private void addSkills(Map<String, String> target, List<String> values) {
        if (values == null) {
            return;
        }
        for (String value : values) {
            String original = value == null ? "" : value.trim();
            String normalized = normalizeToken(original);
            if (!original.isBlank() && !normalized.isBlank()) {
                target.putIfAbsent(normalized, original);
            }
        }
    }

    private Map<String, String> skillMap(List<String> values) {
        Map<String, String> result = new LinkedHashMap<>();
        addSkills(result, values);
        return result;
    }

    private List<String> intersection(Map<String, String> requirements, Map<String, String> candidateSkills) {
        List<String> matched = new ArrayList<>();
        for (Map.Entry<String, String> entry : requirements.entrySet()) {
            if (candidateSkills.containsKey(entry.getKey())) {
                matched.add(entry.getValue());
            }
        }
        return matched;
    }

    private List<String> difference(Map<String, String> requirements, Map<String, String> candidateSkills) {
        List<String> missing = new ArrayList<>();
        for (Map.Entry<String, String> entry : requirements.entrySet()) {
            if (!candidateSkills.containsKey(entry.getKey())) {
                missing.add(entry.getValue());
            }
        }
        return missing;
    }

    private List<String> extras(Map<String, String> candidateSkills, Set<String> requiredSkills) {
        List<String> extras = new ArrayList<>();
        for (Map.Entry<String, String> entry : candidateSkills.entrySet()) {
            if (!requiredSkills.contains(entry.getKey())) {
                extras.add(entry.getValue());
            }
        }
        return extras;
    }

    private double coverage(int matched, int total) {
        return total <= 0 ? 1.0d : matched / (double) total;
    }

    private int coverageCount(List<String> candidateValues, List<String> requiredValues) {
        if (requiredValues == null || requiredValues.isEmpty()) {
            return 100;
        }
        Map<String, String> candidateMap = skillMap(candidateValues);
        Map<String, String> requirementMap = skillMap(requiredValues);
        return clamp((int) Math.round((intersection(requirementMap, candidateMap).size() / (double) requirementMap.size()) * 100));
    }

    private int experienceYears(StructuredCvProfile cvProfile) {
        if (cvProfile.candidateProfile() != null && cvProfile.candidateProfile().yearsOfExperience() > 0) {
            return cvProfile.candidateProfile().yearsOfExperience();
        }
        if (cvProfile.experience() == null || cvProfile.experience().isEmpty()) {
            return 0;
        }
        int months = cvProfile.experience().stream().mapToInt(StructuredCvProfile.ExperienceItem::durationMonths).sum();
        return months <= 0 ? 0 : Math.max(1, months / 12);
    }

    private int minYears(StructuredJobRequirements jobRequirements) {
        return jobRequirements.requirements() == null ? 0 : Math.max(jobRequirements.requirements().minYearsExperience(), 0);
    }

    private String normalizeToken(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        value = NON_ALNUM.matcher(value).replaceAll(" ").trim();
        return switch (value) {
            case "reactjs", "react js" -> "react";
            case "golang" -> "go";
            case "postgre", "postgres", "postgresql db" -> "postgresql";
            case "restful api", "restful apis", "restful services", "rest api", "rest apis" -> "rest api";
            case "spring", "spring boot framework" -> "spring boot";
            case "nodejs", "node js" -> "node.js";
            case "amazon web services" -> "aws";
            case "google cloud platform" -> "gcp";
            case "ms sql", "mssql", "sql server" -> "sql server";
            default -> value;
        };
    }

    private Set<String> normalizedSet(List<String> values) {
        Set<String> normalized = new LinkedHashSet<>();
        if (values == null) {
            return normalized;
        }
        for (String value : values) {
            String token = normalizeToken(value);
            if (!token.isBlank()) {
                normalized.add(token);
            }
        }
        return normalized;
    }

    private String normalizeSeniority(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (normalized.contains("intern")) return "intern";
        if (normalized.contains("junior") || normalized.contains("entry") || normalized.contains("fresher")) return "junior";
        if (normalized.contains("mid")) return "mid";
        if (normalized.contains("senior") || normalized.contains("sr")) return "senior";
        if (normalized.contains("lead") || normalized.contains("principal")) return "lead";
        if (normalized.contains("manager")) return "manager";
        return normalized;
    }

    private int seniorityRank(String seniority) {
        return switch (normalizeSeniority(seniority)) {
            case "intern" -> 0;
            case "junior" -> 1;
            case "mid" -> 2;
            case "senior" -> 3;
            case "lead", "manager" -> 4;
            default -> 2;
        };
    }

    private int clamp(int score) {
        return Math.max(0, Math.min(100, score));
    }

    private String scoreLabel(int score) {
        if (score >= 85) return "Excellent";
        if (score >= 70) return "Good";
        if (score >= 50) return "Fair";
        return "Poor";
    }

    private record SkillIndex(Map<String, String> byNormalized) {}

    private record RequirementIndex(
            Map<String, String> mustHaveByNormalized,
            Map<String, String> niceToHaveByNormalized,
            Set<String> allRequiredNormalized
    ) {}
}
