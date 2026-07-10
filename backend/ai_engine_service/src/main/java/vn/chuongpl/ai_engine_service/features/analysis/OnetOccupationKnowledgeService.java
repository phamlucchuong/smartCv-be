package vn.chuongpl.ai_engine_service.features.analysis;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.chuongpl.ai_engine_service.config.OnetProperties;
import vn.chuongpl.ai_engine_service.integration.onet.OnetClient;
import vn.chuongpl.ai_engine_service.integration.onet.OnetEducationResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetJobZoneResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetKnowledgeResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetOccupationBundle;
import vn.chuongpl.ai_engine_service.integration.onet.OnetOverviewResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetSearchResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetSkillsResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetTasksResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetTechnologySkillsResponse;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OnetOccupationKnowledgeService {

    private static final Pattern YEARS_PATTERN = Pattern.compile("(\\d+)");

    private final OnetClient onetClient;
    private final PromptBuilder promptBuilder;
    private final AiModelGatewayRouter modelRouter;
    private final OnetProperties onetProperties;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public Optional<OnetJobProfile> resolve(StructuredCvProfile cvProfile) {
        if (cvProfile == null || cvProfile.candidateProfile() == null) {
            return Optional.empty();
        }
        if (!onetProperties.isConfigured()) {
            return Optional.empty();
        }

        String targetRole = firstNonBlank(cvProfile.candidateProfile().targetRoles());
        if (targetRole.isBlank()) {
            return Optional.empty();
        }

        try {
            OnetSearchResponse search = onetClient.searchOccupations(targetRole, onetProperties.getSearchLimit());
            OnetSearchResponse.Occupation best = chooseBestOccupation(search, cvProfile);
            if (best == null) {
                return Optional.empty();
            }

            OnetOccupationBundle bundle = loadBundle(best);
            StructuredJobRequirements requirements = extractRequirements(bundle, cvProfile);
            return Optional.of(new OnetJobProfile(
                    safe(bundle.overview().title()),
                    safe(bundle.overview().title()),
                    buildDescription(bundle),
                    buildSkillsSummary(bundle),
                    buildRequirementsSummary(requirements, bundle),
                    requirements
            ));
        } catch (Exception e) {
            log.warn("O*NET resolution failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private OnetOccupationBundle loadBundle(OnetSearchResponse.Occupation occupation) {
        String code = occupation.code();
        OnetOverviewResponse overview = onetClient.getOverview(code);
        OnetJobZoneResponse jobZone = onetClient.getJobZone(code);
        OnetTasksResponse tasks = onetClient.getTasks(code);
        OnetSkillsResponse skills = onetClient.getSkills(code);
        OnetKnowledgeResponse knowledge = onetClient.getKnowledge(code);
        OnetTechnologySkillsResponse technologySkills = onetClient.getTechnologySkills(code);
        OnetEducationResponse education = onetClient.getEducation(code);
        return new OnetOccupationBundle(occupation, overview, jobZone, tasks, skills, knowledge, technologySkills, education);
    }

    private OnetSearchResponse.Occupation chooseBestOccupation(OnetSearchResponse response, StructuredCvProfile cvProfile) {
        if (response == null || response.occupation() == null || response.occupation().isEmpty()) {
            return null;
        }
        String targetRole = normalize(firstNonBlank(cvProfile.candidateProfile().targetRoles()));
        int targetZone = desiredJobZone(cvProfile);

        OnetSearchResponse.Occupation best = null;
        double bestScore = Double.NEGATIVE_INFINITY;
        int index = 0;
        for (OnetSearchResponse.Occupation occupation : response.occupation()) {
            double titleScore = similarity(targetRole, normalize(occupation.title()));
            double aliasBoost = occupation.title() != null && normalize(occupation.title()).contains(targetRole) ? 0.15d : 0d;
            double searchRankBoost = Math.max(0d, 0.35d - (index * 0.05d));
            double score = titleScore + aliasBoost + searchRankBoost;
            try {
                OnetJobZoneResponse zone = onetClient.getJobZone(occupation.code());
                score -= Math.abs(targetZone - parseJobZone(zone.jobZone())) * 0.05d;
            } catch (Exception ignored) {
            }
            if (score > bestScore) {
                bestScore = score;
                best = occupation;
            }
            index++;
        }
        return best;
    }

    private StructuredJobRequirements extractRequirements(OnetOccupationBundle bundle, StructuredCvProfile cvProfile) {
        StructuredJobRequirements fallback = fallbackRequirements(bundle, cvProfile);
        try {
            String onetJson = mapper.writeValueAsString(Map.of(
                    "overview", bundle.overview(),
                    "jobZone", bundle.jobZone(),
                    "tasks", bundle.tasks(),
                    "skills", bundle.skills(),
                    "knowledge", bundle.knowledge(),
                    "technologySkills", bundle.technologySkills(),
                    "education", bundle.education()
            ));
            String prompt = promptBuilder.buildExtractOnetRequirementsPrompt(Map.of(
                    "TARGET_ROLE", firstNonBlank(cvProfile.candidateProfile().targetRoles()),
                    "TARGET_LEVEL", safe(cvProfile.candidateProfile().seniorityLevel()),
                    "TARGET_YEARS", String.valueOf(cvProfile.candidateProfile().yearsOfExperience()),
                    "ONET_JOB_JSON", onetJson
            ));
            StructuredJobRequirements parsed = parse(modelRouter.call(promptBuilder.systemPrompt(), prompt));
            return merge(parsed, fallback);
        } catch (Exception e) {
            log.warn("Failed to map O*NET bundle through LLM, using deterministic fallback: {}", e.getMessage());
            return fallback;
        }
    }

    private StructuredJobRequirements parse(String raw) throws Exception {
        return mapper.readValue(extractJson(raw), StructuredJobRequirements.class);
    }

    private StructuredJobRequirements merge(StructuredJobRequirements parsed, StructuredJobRequirements fallback) {
        if (parsed == null) {
            return fallback;
        }
        StructuredJobRequirements.JobInfo parsedInfo = parsed.jobInfo() == null ? fallback.jobInfo() : parsed.jobInfo();
        StructuredJobRequirements.RequirementProfile parsedReq = parsed.requirements() == null ? fallback.requirements() : parsed.requirements();
        StructuredJobRequirements.RequirementProfile fallbackReq = fallback.requirements();
        return new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo(
                        blankOr(parsedInfo.title(), fallback.jobInfo().title()),
                        blankOr(parsedInfo.seniorityLevel(), fallback.jobInfo().seniorityLevel()),
                        blankOr(parsedInfo.domain(), fallback.jobInfo().domain()),
                        blankOr(parsedInfo.employmentType(), fallback.jobInfo().employmentType())
                ),
                new StructuredJobRequirements.RequirementProfile(
                        prefer(parsedReq.mustHaveSkills(), fallbackReq.mustHaveSkills()),
                        prefer(parsedReq.niceToHaveSkills(), fallbackReq.niceToHaveSkills()),
                        prefer(parsedReq.mustHaveTools(), fallbackReq.mustHaveTools()),
                        prefer(parsedReq.mustHaveFrameworks(), fallbackReq.mustHaveFrameworks()),
                        prefer(parsedReq.mustHaveDatabases(), fallbackReq.mustHaveDatabases()),
                        prefer(parsedReq.mustHaveCloud(), fallbackReq.mustHaveCloud()),
                        prefer(parsedReq.mustHaveLanguages(), fallbackReq.mustHaveLanguages()),
                        prefer(parsedReq.mustHaveCertifications(), fallbackReq.mustHaveCertifications()),
                        parsedReq.minYearsExperience() > 0 ? parsedReq.minYearsExperience() : fallbackReq.minYearsExperience()
                ),
                prefer(parsed.responsibilitySignals(), fallback.responsibilitySignals()),
                prefer(parsed.screeningQuestions(), fallback.screeningQuestions())
        );
    }

    private StructuredJobRequirements fallbackRequirements(OnetOccupationBundle bundle, StructuredCvProfile cvProfile) {
        List<String> mustHaveSkills = distinct(bundle.skills() == null || bundle.skills().element() == null
                ? Collections.emptyList()
                : bundle.skills().element().stream().map(OnetSkillsResponse.Element::name).limit(6).toList());
        List<String> knowledge = distinct(bundle.knowledge() == null || bundle.knowledge().element() == null
                ? Collections.emptyList()
                : bundle.knowledge().element().stream().map(OnetKnowledgeResponse.Element::name).limit(4).toList());
        List<String> techExamples = distinct(flattenTechnologyExamples(bundle.technologySkills()).stream().limit(8).toList());
        List<String> frameworks = techExamples.stream().filter(this::isFramework).toList();
        List<String> databases = techExamples.stream().filter(this::isDatabase).toList();
        List<String> cloud = techExamples.stream().filter(this::isCloud).toList();
        List<String> tools = techExamples.stream()
                .filter(value -> !frameworks.contains(value) && !databases.contains(value) && !cloud.contains(value))
                .toList();

        List<String> responsibilitySignals = bundle.tasks() == null || bundle.tasks().task() == null
                ? Collections.emptyList()
                : distinct(bundle.tasks().task().stream().map(OnetTasksResponse.Task::title).limit(6).toList());
        List<String> certifications = bundle.education() == null || bundle.education().response() == null
                ? Collections.emptyList()
                : bundle.education().response().stream()
                .map(OnetEducationResponse.ResponseItem::title)
                .filter(value -> value != null && value.toLowerCase(Locale.ROOT).contains("cert"))
                .toList();

        mustHaveSkills = mergeDistinct(mustHaveSkills, knowledge);

        return new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo(
                        safe(bundle.overview().title()),
                        normalizeSeniority(cvProfile.candidateProfile().seniorityLevel()),
                        inferDomain(bundle.overview().description()),
                        "Full-time"
                ),
                new StructuredJobRequirements.RequirementProfile(
                        mustHaveSkills,
                        techExamples.stream().filter(value -> !tools.contains(value) && !frameworks.contains(value)).limit(4).toList(),
                        tools,
                        frameworks,
                        databases,
                        cloud,
                        Collections.emptyList(),
                        certifications,
                        deriveMinYears(bundle.jobZone(), cvProfile)
                ),
                responsibilitySignals,
                Collections.emptyList()
        );
    }

    private String buildDescription(OnetOccupationBundle bundle) {
        List<String> parts = new ArrayList<>();
        if (bundle.overview() != null && bundle.overview().description() != null && !bundle.overview().description().isBlank()) {
            parts.add(bundle.overview().description());
        }
        if (bundle.jobZone() != null) {
            if (bundle.jobZone().education() != null && !bundle.jobZone().education().isBlank()) {
                parts.add("Typical education: " + bundle.jobZone().education());
            }
            if (bundle.jobZone().relatedExperience() != null && !bundle.jobZone().relatedExperience().isBlank()) {
                parts.add("Related experience: " + bundle.jobZone().relatedExperience());
            }
        }
        return String.join("\n", parts);
    }

    private String buildSkillsSummary(OnetOccupationBundle bundle) {
        Set<String> skills = new LinkedHashSet<>();
        if (bundle.skills() != null && bundle.skills().element() != null) {
            bundle.skills().element().stream().map(OnetSkillsResponse.Element::name).limit(6).forEach(skills::add);
        }
        flattenTechnologyExamples(bundle.technologySkills()).stream().limit(8).forEach(skills::add);
        return String.join(", ", skills);
    }

    private String buildRequirementsSummary(StructuredJobRequirements requirements, OnetOccupationBundle bundle) {
        List<String> lines = new ArrayList<>();
        if (requirements.requirements() != null && requirements.requirements().minYearsExperience() > 0) {
            lines.add(requirements.requirements().minYearsExperience() + "+ years relevant experience");
        }
        lines.addAll(safeList(requirements.responsibilitySignals()));
        if (bundle.jobZone() != null && bundle.jobZone().education() != null && !bundle.jobZone().education().isBlank()) {
            lines.add("Typical education: " + bundle.jobZone().education());
        }
        return String.join("\n", distinct(lines));
    }

    private List<String> flattenTechnologyExamples(OnetTechnologySkillsResponse response) {
        Set<String> values = new LinkedHashSet<>();
        if (response == null) {
            return Collections.emptyList();
        }
        response.getCategory().forEach(category -> category.example().forEach(example -> {
            String value = blankOr(example.title(), example.name());
            if (!value.isBlank()) {
                values.add(value);
            }
        }));
        response.getExample().forEach(example -> {
            String value = blankOr(example.title(), example.name());
            if (!value.isBlank()) {
                values.add(value);
            }
        });
        return new ArrayList<>(values);
    }

    private int desiredJobZone(StructuredCvProfile cvProfile) {
        String seniority = normalizeSeniority(cvProfile.candidateProfile().seniorityLevel());
        int years = cvProfile.candidateProfile().yearsOfExperience();
        if ("lead".equals(seniority) || "manager".equals(seniority) || years >= 8) {
            return 5;
        }
        if ("senior".equals(seniority) || years >= 5) {
            return 4;
        }
        if ("mid".equals(seniority) || years >= 2) {
            return 4;
        }
        return 3;
    }

    private int parseJobZone(String text) {
        Matcher matcher = YEARS_PATTERN.matcher(safe(text));
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }
        String normalized = safe(text).toLowerCase(Locale.ROOT);
        if (normalized.contains("five")) return 5;
        if (normalized.contains("four")) return 4;
        if (normalized.contains("three")) return 3;
        if (normalized.contains("two")) return 2;
        if (normalized.contains("one")) return 1;
        return 3;
    }

    private int deriveMinYears(OnetJobZoneResponse jobZone, StructuredCvProfile cvProfile) {
        int zone = parseJobZone(jobZone == null ? "" : jobZone.jobZone());
        int baseline = switch (zone) {
            case 1 -> 0;
            case 2 -> 1;
            case 3 -> 2;
            case 4 -> 3;
            default -> 5;
        };
        int candidateYears = cvProfile.candidateProfile() == null ? 0 : cvProfile.candidateProfile().yearsOfExperience();
        String seniority = normalizeSeniority(cvProfile.candidateProfile() == null ? "" : cvProfile.candidateProfile().seniorityLevel());
        int levelFloor = switch (seniority) {
            case "senior" -> 5;
            case "lead", "manager" -> 7;
            case "mid" -> 2;
            default -> 0;
        };
        if (candidateYears > 0 && levelFloor == 0) {
            levelFloor = Math.max(0, candidateYears - 1);
        }
        return Math.max(baseline, levelFloor);
    }

    private double similarity(String a, String b) {
        if (a.isBlank() || b.isBlank()) {
            return 0;
        }
        Set<String> left = java.util.Arrays.stream(a.split(" "))
                .filter(token -> !token.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> right = java.util.Arrays.stream(b.split(" "))
                .filter(token -> !token.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        long overlap = left.stream().filter(right::contains).count();
        return overlap / (double) Math.max(left.size(), right.size());
    }

    private boolean isFramework(String value) {
        String normalized = normalize(value);
        return normalized.contains("spring") || normalized.contains("react") || normalized.contains("angular")
                || normalized.contains("django") || normalized.contains("flask") || normalized.contains("laravel")
                || normalized.contains("express") || normalized.contains("vue");
    }

    private boolean isDatabase(String value) {
        String normalized = normalize(value);
        return normalized.contains("sql") || normalized.contains("postgres") || normalized.contains("mysql")
                || normalized.contains("oracle") || normalized.contains("mongodb") || normalized.contains("redis");
    }

    private boolean isCloud(String value) {
        String normalized = normalize(value);
        return normalized.contains("aws") || normalized.contains("azure") || normalized.contains("gcp")
                || normalized.contains("kubernetes") || normalized.contains("docker");
    }

    private String inferDomain(String description) {
        String normalized = safe(description).toLowerCase(Locale.ROOT);
        if (normalized.contains("software")) {
            return "Tech";
        }
        return "";
    }

    private String normalizeSeniority(String value) {
        String normalized = safe(value).toLowerCase(Locale.ROOT);
        if (normalized.contains("lead")) return "Lead";
        if (normalized.contains("manager")) return "Manager";
        if (normalized.contains("senior")) return "Senior";
        if (normalized.contains("mid")) return "Mid";
        if (normalized.contains("junior")) return "Junior";
        if (normalized.contains("intern")) return "Intern";
        return safe(value);
    }

    private String extractJson(String raw) {
        String trimmed = safe(raw).trim();
        int objectStart = trimmed.indexOf('{');
        int objectEnd = trimmed.lastIndexOf('}');
        return objectStart >= 0 && objectEnd > objectStart
                ? trimmed.substring(objectStart, objectEnd + 1)
                : trimmed;
    }

    private List<String> distinct(List<String> values) {
        return safeList(values).stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    private List<String> prefer(List<String> primary, List<String> fallback) {
        return primary == null || primary.isEmpty() ? safeList(fallback) : distinct(primary);
    }

    private List<String> mergeDistinct(List<String> left, List<String> right) {
        LinkedHashSet<String> merged = new LinkedHashSet<>(safeList(left));
        merged.addAll(safeList(right));
        return merged.stream().filter(value -> value != null && !value.isBlank()).toList();
    }

    private List<String> safeList(List<String> values) {
        return values == null ? Collections.emptyList() : values;
    }

    private String blankOr(String primary, String fallback) {
        return primary == null || primary.isBlank() ? safe(fallback) : primary;
    }

    private String firstNonBlank(List<String> values) {
        if (values == null) {
            return "";
        }
        return values.stream().filter(value -> value != null && !value.isBlank()).findFirst().orElse("");
    }

    private String normalize(String value) {
        return safe(value).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9+#. ]", " ").replaceAll("\\s+", " ").trim();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
