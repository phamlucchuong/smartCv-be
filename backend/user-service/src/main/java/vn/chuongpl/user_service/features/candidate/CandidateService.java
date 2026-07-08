package vn.chuongpl.user_service.features.candidate;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import vn.chuongpl.user_service.dtos.PageResponse;
import vn.chuongpl.user_service.dtos.request.CandidateRequest;
import vn.chuongpl.user_service.dtos.response.CandidateResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.candidate.settings.CandidateSettings;
import vn.chuongpl.user_service.features.candidate.settings.NotificationPreferences;
import vn.chuongpl.user_service.features.candidate.settings.PrivacySettings;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;
import vn.chuongpl.user_service.features.candidate.dto.CvInfoResponse;
import vn.chuongpl.user_service.integration.job.JobClient;
import vn.chuongpl.user_service.integration.job.JobSummary;
import vn.chuongpl.user_service.integration.notification.CvAnalysisDonePublisher;
import vn.chuongpl.user_service.integration.notification.AiCreditExhaustedPublisher;


import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class CandidateService {
    CandidateRepository candidateRepository;
    UserRepository userRepository;
    ServicePackageRepository servicePackageRepository;
    CandidateMapper candidateMapper;
    JobClient jobClient;
    S3Service s3Service;
    CvAnalysisDonePublisher cvAnalysisDonePublisher;
    AiCreditExhaustedPublisher aiCreditExhaustedPublisher;


    public CandidateResponse create(CandidateRequest request) {
        User user = userRepository.findById(request.getUserId()).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (candidateRepository.findByUserIdAndDeletedFalse(request.getUserId()).isPresent()) throw new AppException(ErrorCode.CANDIDATE_EXISTED);

        Candidate candidate = candidateMapper.toCandidate(request);
        candidate.setCreatedAt(LocalDateTime.now());
        candidate.setUpdatedAt(LocalDateTime.now());
        candidate.setDeleted(false);
        candidate.setMonthlyAiCreditsUsed(0);
        candidate.setMonthlyAiCreditsMonth(currentMonthKey());

        return candidateMapper.toCandidateResponse(candidateRepository.save(candidate), user);
    }

    public void createBasicProfile(String userId) {
        if (candidateRepository.findByUserIdAndDeletedFalse(userId).isPresent()) return;
        Candidate candidate = Candidate.builder()
                .userId(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .deleted(false)
                .monthlyAiCreditsUsed(0)
                .monthlyAiCreditsMonth(currentMonthKey())
                .build();
        candidateRepository.save(candidate);
    }

    public CandidateResponse getById(String id) {
        Candidate candidate = candidateRepository.findByIdAndDeletedFalse(id).orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        // Tolerate a missing user record (consistent with getAll); the candidate
        // profile is still viewable even if its user link is dangling.
        User user = userRepository.findById(candidate.getUserId()).orElse(null);
        return toCandidateResponseWithFreshCv(candidate, user);
    }

    public CandidateResponse getByUserId(String userId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId).orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        candidate = normalizeExpiredPackage(candidate);
        User user = userRepository.findById(userId).orElse(null);
        return toCandidateResponseWithFreshCv(candidate, user);
    }

    public PageResponse<CandidateResponse> getAll(int page, int size) {
        int pageCurrent = page > 0 ? page - 1 : 0;
        int safeSize = size > 0 ? size : 10;
        Pageable pageable = PageRequest.of(pageCurrent, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Candidate> candidates = candidateRepository.findAllByDeletedFalse(pageable);

        return PageResponse.<CandidateResponse>builder()
                .items(candidates.getContent().stream().map(candidate -> {
                    User user = userRepository.findById(candidate.getUserId()).orElse(null);
                    return toCandidateResponseWithFreshCv(candidate, user);
                }).toList())
                .total(candidates.getTotalElements())
                .page(pageCurrent + 1)
                .pageSize(safeSize)
                .totalPages(candidates.getTotalPages())
                .build();
    }

    public CandidateResponse update(String id, CandidateRequest request, String currentUserId, boolean isAdmin) {
        Candidate candidate = candidateRepository.findByIdAndDeletedFalse(id).orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        if (!isAdmin && !candidate.getUserId().equals(currentUserId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        User user = userRepository.findById(candidate.getUserId()).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        String fixedUserId = candidate.getUserId();
        candidateMapper.updateCandidate(candidate, request);
        candidate.setUserId(fixedUserId);
        candidate.setUpdatedAt(LocalDateTime.now());
        return toCandidateResponseWithFreshCv(candidateRepository.save(candidate), user);
    }

    public CandidateResponse getMe(String userId) {
        return getByUserId(userId);
    }

    public String uploadAvatar(String userId, org.springframework.web.multipart.MultipartFile file) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        String oldAvatarUrl = candidate.getAvatarUrl();
        if (oldAvatarUrl != null && !oldAvatarUrl.isBlank()) {
            s3Service.deleteAvatar(oldAvatarUrl);
        }
        String avatarUrl = s3Service.uploadAvatar(file, userId);
        candidate.setAvatarUrl(avatarUrl);
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
        return avatarUrl;
    }

    public CandidateResponse saveCvUrl(String userId, String cvUrl) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        candidate.setCvUrl(cvUrl);
        candidate.setUpdatedAt(LocalDateTime.now());
        return candidateMapper.toCandidateResponse(candidateRepository.save(candidate), user);
    }

    public void mergeSkills(String userId, List<String> newSkills) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));

        List<String> existing = candidate.getSkills() != null
                ? new ArrayList<>(candidate.getSkills())
                : new ArrayList<>();

        Set<String> existingLower = existing.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (newSkills != null) {
            for (String skill : newSkills) {
                if (skill == null || skill.isBlank()) {
                    continue;
                }
                String normalized = skill.toLowerCase(Locale.ROOT);
                if (!existingLower.contains(normalized)) {
                    existing.add(skill);
                    existingLower.add(normalized);
                }
            }
        }

        candidate.setSkills(existing);
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    public void delete(String id) {
        Candidate candidate = candidateRepository.findByIdAndDeletedFalse(id).orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        candidate.setDeleted(true);
        candidate.setDeletedAt(LocalDateTime.now());
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    // ── CV Management ─────────────────────────────────────────────────────────

    public List<CvItem> listCvs(String userId) {
        List<CvItem> cvs = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND))
                .getCvs();
        cvs.forEach(cv -> {
            if (cv.getS3Key() != null) {
                cv.setUrl(s3Service.generateFreshUrl(cv.getS3Key()));
            }
        });
        return cvs;
    }

    public void addCvToList(String userId, String s3Key, String url, String filename) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        boolean isFirst = candidate.getCvs().isEmpty();
        CvItem item = CvItem.builder()
                .id(UUID.randomUUID().toString())
                .s3Key(s3Key)
                .url(url)
                .filename(filename)
                .isDefault(isFirst)
                .uploadedAt(LocalDateTime.now())
                .build();
        candidate.getCvs().add(item);
        if (isFirst) candidate.setCvUrl(url);
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    public void setDefaultCv(String userId, String cvId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        CvItem target = candidate.getCvs().stream()
                .filter(cv -> cvId.equals(cv.getId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
        candidate.getCvs().forEach(cv -> cv.setDefault(false));
        target.setDefault(true);
        candidate.setCvUrl(target.getUrl());
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    public void deleteCv(String userId, String cvId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        CvItem toRemove = candidate.getCvs().stream()
                .filter(cv -> cvId.equals(cv.getId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
        boolean wasDefault = toRemove.isDefault();
        candidate.getCvs().remove(toRemove);
        if (wasDefault && !candidate.getCvs().isEmpty()) {
            CvItem next = candidate.getCvs().stream()
                    .max(Comparator.comparing(CvItem::getUploadedAt))
                    .orElse(candidate.getCvs().get(0));
            next.setDefault(true);
            candidate.setCvUrl(next.getUrl());
        }
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    public String refreshCvUrl(String userId, String cvId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        CvItem cv = candidate.getCvs().stream()
                .filter(c -> cvId.equals(c.getId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
        if (cv.getS3Key() == null) return cv.getUrl();
        return s3Service.generateFreshUrl(cv.getS3Key());
    }

    public CvItem getCvAnalysis(String userId, String cvId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        return candidate.getCvs().stream()
                .filter(cv -> cvId.equals(cv.getId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
    }

    public void markCvReanalyzing(String userId, String cvId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        candidate.getCvs().stream()
                .filter(cv -> cvId.equals(cv.getId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND))
                .setAnalysisStatus(CvAnalysisStatus.PENDING);
        candidateRepository.save(candidate);
    }

    public void consumeMonthlyAiCredit(String userId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        candidate = normalizeExpiredPackage(candidate);

        ServicePackage servicePackage = resolveActivePackage(candidate.getActivePackageId());
        candidate.setMonthlyAiCreditsMonth(refreshCreditMonth(candidate));

        Integer limit = servicePackage.getAiCredits();
        if (limit != null && limit != -1 && candidate.getMonthlyAiCreditsUsed() >= limit) {
            aiCreditExhaustedPublisher.publish(userId, "CANDIDATE");
            throw new AppException(ErrorCode.INSUFFICIENT_AI_QUOTA);
        }


        candidate.setMonthlyAiCreditsUsed(candidate.getMonthlyAiCreditsUsed() + 1);
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    public CandidateSettings getSettings(String userId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        return ensureSettings(candidate);
    }

    public void updateNotificationPreferences(String userId, NotificationPreferences prefs) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        ensureSettings(candidate).setNotifications(prefs != null ? prefs : new NotificationPreferences());
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    public void updatePrivacySettings(String userId, PrivacySettings privacy) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        ensureSettings(candidate).setPrivacy(privacy != null ? privacy : new PrivacySettings());
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    public vn.chuongpl.user_service.features.candidate.settings.PreferencesSettings updatePreferences(
            String userId, vn.chuongpl.user_service.features.candidate.settings.PreferencesSettingsRequest request) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        vn.chuongpl.user_service.features.candidate.settings.CandidateSettings settings = ensureSettings(candidate);
        if (request != null) {
            vn.chuongpl.user_service.features.candidate.settings.PreferencesSettings prefs =
                    settings.getPreferences() != null
                            ? settings.getPreferences()
                            : new vn.chuongpl.user_service.features.candidate.settings.PreferencesSettings();
            if (request.getLanguage() != null) prefs.setLanguage(request.getLanguage());
            if (request.getTheme() != null) prefs.setTheme(request.getTheme());
            settings.setPreferences(prefs);
        }
        candidate.setUpdatedAt(java.time.LocalDateTime.now());
        candidateRepository.save(candidate);
        return settings.getPreferences();
    }

    private CandidateSettings ensureSettings(Candidate candidate) {
        if (candidate.getSettings() == null) {
            candidate.setSettings(new CandidateSettings());
        }
        CandidateSettings settings = candidate.getSettings();
        if (settings.getNotifications() == null) {
            settings.setNotifications(new NotificationPreferences());
        }
        if (settings.getPrivacy() == null) {
            settings.setPrivacy(new PrivacySettings());
        }
        if (settings.getPreferences() == null) {
            settings.setPreferences(new vn.chuongpl.user_service.features.candidate.settings.PreferencesSettings());
        }
        return settings;
    }

    private CandidateResponse toCandidateResponseWithFreshCv(Candidate candidate, User user) {
        CandidateResponse response = candidateMapper.toCandidateResponse(candidate, user);
        response.setCvUrl(resolveFreshDefaultCvUrl(candidate));
        populateAiCreditSummary(response, candidate);
        return response;
    }

    private String resolveFreshDefaultCvUrl(Candidate candidate) {
        if (candidate == null) {
            return null;
        }
        CvItem defaultCv = candidate.getCvs() == null
                ? null
                : candidate.getCvs().stream().filter(CvItem::isDefault).findFirst().orElse(null);
        if (defaultCv != null) {
            if (defaultCv.getS3Key() != null && !defaultCv.getS3Key().isBlank()) {
                return s3Service.generateFreshUrl(defaultCv.getS3Key());
            }
            return defaultCv.getUrl();
        }
        return candidate.getCvUrl();
    }

    private ServicePackage resolveActivePackage(String activePackageId) {
        String packageId = activePackageId == null || activePackageId.isBlank() ? "free" : activePackageId;
        return servicePackageRepository.findById(packageId)
                .orElseGet(() -> servicePackageRepository.findById("free")
                        .orElseThrow(() -> new AppException(ErrorCode.SERVICE_PACKAGE_NOT_FOUND)));
    }

    private String refreshCreditMonth(Candidate candidate) {
        String currentMonth = currentMonthKey();
        if (!currentMonth.equals(candidate.getMonthlyAiCreditsMonth())) {
            candidate.setMonthlyAiCreditsUsed(0);
            candidate.setMonthlyAiCreditsMonth(currentMonth);
        }
        return candidate.getMonthlyAiCreditsMonth();
    }

    private String currentMonthKey() {
        return YearMonth.now().toString();
    }

    private void populateAiCreditSummary(CandidateResponse response, Candidate candidate) {
        Integer total = resolveAiCreditsTotal(candidate.getActivePackageId());
        int used = resolveCurrentAiCreditsUsed(candidate.getMonthlyAiCreditsMonth(), candidate.getMonthlyAiCreditsUsed());

        response.setAiCreditsTotal(total);
        response.setAiCreditsUsed(used);
        response.setAiCreditsRemaining(resolveRemainingAiCredits(total, used));
    }

    private int resolveCurrentAiCreditsUsed(String usageMonth, int used) {
        return currentMonthKey().equals(usageMonth) ? used : 0;
    }

    private Integer resolveRemainingAiCredits(Integer total, int used) {
        if (total == null || total == -1) {
            return total;
        }
        return Math.max(total - used, 0);
    }

    private Integer resolveAiCreditsTotal(String activePackageId) {
        String packageId = activePackageId == null || activePackageId.isBlank() ? "free" : activePackageId;
        return servicePackageRepository.findById(packageId)
                .or(() -> servicePackageRepository.findById("free"))
                .map(ServicePackage::getAiCredits)
                .orElse(null);
    }

    private Candidate normalizeExpiredPackage(Candidate candidate) {
        if (candidate.getPackageExpiresAt() == null) {
            return candidate;
        }
        if (candidate.getPackageExpiresAt().isAfter(LocalDateTime.now())) {
            return candidate;
        }
        if ("free".equalsIgnoreCase(candidate.getActivePackageId())) {
            return candidate;
        }

        candidate.setActivePackageId("free");
        candidate.setPackageActivatedAt(null);
        candidate.setPackageExpiresAt(null);
        candidate.setMonthlyAiCreditsUsed(0);
        candidate.setMonthlyAiCreditsMonth(currentMonthKey());
        candidate.setUpdatedAt(LocalDateTime.now());
        return candidateRepository.save(candidate);
    }

    public void deleteAccount(String userId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        candidate.setDeleted(true);
        candidate.setDeletedAt(LocalDateTime.now());
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
        user.setDeleted(true);
        user.setDeletedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    // ── Job Suggestions ───────────────────────────────────────────────────────

    public List<JobSuggestion> getJobSuggestions(String userId) {
        return candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND))
                .getJobSuggestions();
    }

    public List<EnrichedJobSuggestion> getEnrichedJobSuggestions(String userId) {
        List<JobSuggestion> suggestions = getJobSuggestions(userId);
        if (suggestions.isEmpty()) return List.of();

        List<String> jobIds = suggestions.stream().map(JobSuggestion::getJobId).toList();
        Map<String, JobSummary> jobMap = jobClient.getJobsByIds(jobIds).stream()
                .collect(Collectors.toMap(JobSummary::getId, j -> j));

        return suggestions.stream()
                .map(s -> EnrichedJobSuggestion.builder()
                        .jobId(s.getJobId())
                        .matchScore(s.getMatchScore())
                        .matchReason(s.getMatchReason())
                        .alignedSkills(s.getAlignedSkills())
                        .suggestedAt(s.getSuggestedAt())
                        .job(jobMap.get(s.getJobId()))
                        .build())
                .filter(suggestion -> suggestion.getJob() != null)
                .toList();
    }

    public void updateJobSuggestions(String userId, List<JobSuggestion> suggestions) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        candidate.setJobSuggestions(suggestions);
        candidate.setSuggestionsUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    // ── Company Follow ────────────────────────────────────────────────────────

    public void followCompany(String userId, String companyId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        if (!candidate.getFollowedCompanyIds().contains(companyId)) {
            candidate.getFollowedCompanyIds().add(companyId);
            candidateRepository.save(candidate);
        }
    }

    public void unfollowCompany(String userId, String companyId) {
        Candidate candidate = candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND));
        candidate.getFollowedCompanyIds().remove(companyId);
        candidateRepository.save(candidate);
    }

    public List<String> getFollowedCompanyIds(String userId) {
        return candidateRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_NOT_FOUND))
                .getFollowedCompanyIds();
    }

    // ── Internal CV Analysis ──────────────────────────────────────────────────

    public CvInfoResponse getCvInfo(String cvId) {
        Candidate candidate = candidateRepository.findByCvId(cvId)
                .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
        CvItem cv = candidate.getCvs().stream()
                .filter(c -> cvId.equals(c.getId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
        String url = cv.getS3Key() != null ? s3Service.generateFreshUrl(cv.getS3Key()) : cv.getUrl();
        return new CvInfoResponse(cv.getId(), url, cv.getFilename(), candidate.getUserId());
    }

    public void updateCvAnalysis(String cvId, String analysisResult, CvAnalysisStatus status) {
        Candidate candidate = candidateRepository.findByCvId(cvId)
                .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
        final String[] filenameHolder = {null};
        candidate.getCvs().stream()
                .filter(c -> cvId.equals(c.getId()))
                .findFirst()
                .ifPresent(cv -> {
                    cv.setAnalysisResult(analysisResult);
                    cv.setAnalysisStatus(status);
                    filenameHolder[0] = cv.getFilename();
                });
        candidateRepository.save(candidate);
        if (status == CvAnalysisStatus.DONE && filenameHolder[0] != null) {
            cvAnalysisDonePublisher.publish(candidate.getUserId(), cvId, filenameHolder[0]);
        }
    }

    public void downgradeToFree(String userId) {
        candidateRepository.findByUserIdAndDeletedFalse(userId).ifPresent(candidate -> {
            if ("free".equalsIgnoreCase(candidate.getActivePackageId())) {
                return;
            }
            LocalDateTime now = LocalDateTime.now();
            candidate.setActivePackageId("free");
            candidate.setPackageActivatedAt(null);
            candidate.setPackageExpiresAt(null);
            candidate.setMonthlyAiCreditsUsed(0);
            candidate.setMonthlyAiCreditsMonth(currentMonthKey());
            candidate.setPackageDowngradedAt(now);
            candidate.setPostExpiryCleanupAt(null);
            candidate.setUpdatedAt(now);
            candidateRepository.save(candidate);
        });
    }
}
