package vn.chuongpl.application_service.features.application;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import vn.chuongpl.application_service.dtos.PageResponse;
import vn.chuongpl.application_service.dtos.request.ApplicationCreateRequest;
import vn.chuongpl.application_service.dtos.request.ApplicationStatusUpdateRequest;
import vn.chuongpl.application_service.dtos.response.ApplicationDetailResponse;
import vn.chuongpl.application_service.dtos.response.ApplicationResponse;
import vn.chuongpl.application_service.enums.ApplicationStatus;
import vn.chuongpl.application_service.enums.ErrorCode;
import vn.chuongpl.application_service.exception.AppException;
import vn.chuongpl.application_service.integration.job.JobClient;
import vn.chuongpl.application_service.integration.job.JobResponse;
import vn.chuongpl.application_service.dtos.request.AiScoreUpdateRequest;
import vn.chuongpl.application_service.enums.AiScoringStatus;
import vn.chuongpl.application_service.integration.ai.AiScoringPublisher;
import vn.chuongpl.application_service.integration.notification.NotificationPublisher;
import vn.chuongpl.application_service.integration.user.UserClient;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class ApplicationService {

    ApplicationRepository applicationRepository;
    ApplicationMapper applicationMapper;
    JobClient jobClient;
    UserClient userClient;
    NotificationPublisher notificationPublisher;
    AiScoringPublisher aiScoringPublisher;

    @NonFinal
    @Value("${app.default-page-size:10}")
    int defaultPageSize;

    public ApplicationResponse submit(ApplicationCreateRequest request, String candidateId) {
        JobResponse job = jobClient.getActiveJob(request.getJobId());

        boolean alreadyApplied = applicationRepository.existsByCandidateIdAndJobIdAndStatusIn(
                candidateId,
                request.getJobId(),
                List.of(ApplicationStatus.PENDING, ApplicationStatus.REVIEWING, ApplicationStatus.ACCEPTED)
        );
        if (alreadyApplied) throw new AppException(ErrorCode.APPLICATION_ALREADY_EXISTS);

        Application app = Application.builder()
                .candidateId(candidateId)
                .candidateEmail(userClient.getCandidateEmail(candidateId))
                .jobId(request.getJobId())
                .jobTitle(job.getTitle())
                .recruiterId(job.getRecruiterId())
                .companyName(job.getCompany())
                .jobLocation(job.getLocation())
                .salaryMin(job.getSalaryMin())
                .salaryMax(job.getSalaryMax())
                .jobSkills(job.getSkills())
                .jobType(job.getJobType())
                .coverLetter(request.getCoverLetter())
                .cvUrl(request.getCvUrl())
                .appliedAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Application saved = applicationRepository.save(app);
        aiScoringPublisher.publishScoringRequest(saved);
        String recruiterUserId = userClient.resolveUserIdFromRecruiterId(saved.getRecruiterId());
        notificationPublisher.publishNewApplication(saved, recruiterUserId);
        return applicationMapper.toResponse(saved);
    }

    public PageResponse<ApplicationResponse> getMyApplications(String candidateId, int page, int size) {
        Page<Application> results = applicationRepository.findByCandidateIdAndDeletedFalse(candidateId, buildPageable(page, size));
        return toPage(results, applicationMapper::toResponse, page, size);
    }

    public Object getById(String id, String userId, boolean isAdmin, boolean isRecruiter) {
        Application app = findActiveById(id);

        if (isAdmin) return applicationMapper.toDetailResponse(app);

        if (isRecruiter) {
            String recruiterId = resolveToRecruiterId(userId);
            if (!app.getRecruiterId().equals(recruiterId)) throw new AppException(ErrorCode.UNAUTHORIZED);
            return applicationMapper.toDetailResponse(app);
        }

        if (!app.getCandidateId().equals(userId)) throw new AppException(ErrorCode.UNAUTHORIZED);
        return applicationMapper.toResponse(app);
    }

    public PageResponse<ApplicationDetailResponse> getByJobId(String jobId, String userId, boolean isAdmin, int page, int size) {
        Page<Application> results = applicationRepository.findByJobIdAndDeletedFalse(jobId, buildPageable(page, size));

        if (!isAdmin) {
            String recruiterId = resolveToRecruiterId(userId);
            results.getContent().stream()
                    .filter(a -> !a.getRecruiterId().equals(recruiterId))
                    .findFirst()
                    .ifPresent(a -> {
                        throw new AppException(ErrorCode.UNAUTHORIZED);
                    });
        }

        return toPage(results, applicationMapper::toDetailResponse, page, size);
    }

    public ApplicationDetailResponse updateStatus(String id, ApplicationStatusUpdateRequest request, String userId, boolean isAdmin) {
        Application app = findActiveById(id);

        if (!isAdmin) {
            String recruiterId = resolveToRecruiterId(userId);
            if (!app.getRecruiterId().equals(recruiterId)) throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        validateRecruiterTransition(app.getStatus(), request.getStatus());

        if (request.getStatus() == ApplicationStatus.REJECTED
                && (request.getRejectionReason() == null || request.getRejectionReason().isBlank())) {
            throw new AppException(ErrorCode.APPLICATION_INVALID_TRANSITION);
        }

        applicationMapper.updateStatus(app, request);
        app.setUpdatedAt(LocalDateTime.now());
        Application saved = applicationRepository.save(app);

        notificationPublisher.publishStatusChanged(saved);
        return applicationMapper.toDetailResponse(saved);
    }

    public ApplicationResponse withdraw(String id, String candidateId) {
        Application app = findActiveById(id);

        if (!app.getCandidateId().equals(candidateId)) throw new AppException(ErrorCode.UNAUTHORIZED);

        if (!EnumSet.of(ApplicationStatus.PENDING, ApplicationStatus.REVIEWING).contains(app.getStatus())) {
            throw new AppException(ErrorCode.APPLICATION_STATUS_TERMINAL);
        }

        app.setStatus(ApplicationStatus.WITHDRAWN);
        app.setUpdatedAt(LocalDateTime.now());
        Application saved = applicationRepository.save(app);

        notificationPublisher.publishStatusChanged(saved);
        return applicationMapper.toResponse(saved);
    }

    public void updateAiScore(String id, AiScoreUpdateRequest request) {
        Application app = findActiveById(id);
        app.setAiScore(request.getAiScore());
        app.setMatchedSkills(request.getMatchedSkills());
        app.setMissingSkills(request.getMissingSkills());
        app.setAiStatus(request.getAiStatus() != null ? request.getAiStatus() : AiScoringStatus.SCORED);
        app.setUpdatedAt(LocalDateTime.now());
        applicationRepository.save(app);
    }

    public ApplicationResponse getMyApplicationForJob(String candidateId, String jobId) {
        Application app = applicationRepository
                .findByCandidateIdAndJobIdAndDeletedFalse(candidateId, jobId)
                .orElseThrow(() -> new AppException(ErrorCode.APPLICATION_NOT_FOUND));
        return applicationMapper.toResponse(app);
    }

    public void delete(String id) {
        Application app = findActiveById(id);
        app.setDeleted(true);
        app.setDeletedAt(LocalDateTime.now());
        applicationRepository.save(app);
    }

    public PageResponse<ApplicationDetailResponse> getByRecruiterId(String userId, int page, int size) {
        String recruiterId = resolveToRecruiterId(userId);
        Page<Application> results = applicationRepository.findByRecruiterIdAndDeletedFalse(recruiterId, buildPageable(page, size));
        return toPage(results, applicationMapper::toDetailResponse, page, size);
    }

    public PageResponse<ApplicationDetailResponse> getAll(int page, int size) {
        Page<Application> results = applicationRepository.findAllByDeletedFalse(buildPageable(page, size));
        return toPage(results, applicationMapper::toDetailResponse, page, size);
    }

    private String resolveToRecruiterId(String userId) {
        String recruiterId = userClient.resolveRecruiterId(userId);
        if (recruiterId == null) throw new AppException(ErrorCode.UNAUTHORIZED);
        return recruiterId;
    }

    private Application findActiveById(String id) {
        return applicationRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new AppException(ErrorCode.APPLICATION_NOT_FOUND));
    }

    private void validateRecruiterTransition(ApplicationStatus current, ApplicationStatus next) {
        boolean allowed = switch (current) {
            case PENDING -> next == ApplicationStatus.REVIEWING;
            case REVIEWING -> next == ApplicationStatus.ACCEPTED || next == ApplicationStatus.REJECTED;
            default -> false;
        };
        if (!allowed) throw new AppException(ErrorCode.APPLICATION_INVALID_TRANSITION);
    }

    private Pageable buildPageable(int page, int size) {
        int p = page > 0 ? page - 1 : 0;
        int s = size > 0 ? size : defaultPageSize;
        return PageRequest.of(p, s, Sort.by(Sort.Direction.DESC, "appliedAt"));
    }

    private <T, R> PageResponse<R> toPage(Page<T> page, Function<T, R> mapper, int pageNum, int size) {
        return PageResponse.<R>builder()
                .items(page.getContent().stream().map(mapper).toList())
                .total(page.getTotalElements())
                .page(pageNum > 0 ? pageNum : 1)
                .pageSize(size > 0 ? size : defaultPageSize)
                .totalPages(page.getTotalPages())
                .build();
    }
}
