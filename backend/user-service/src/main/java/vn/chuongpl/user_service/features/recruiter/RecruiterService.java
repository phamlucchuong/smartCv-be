package vn.chuongpl.user_service.features.recruiter;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;
import vn.chuongpl.user_service.dtos.PageResponse;
import vn.chuongpl.user_service.dtos.message.RecruiterPendingEventMessage;
import vn.chuongpl.user_service.dtos.message.RecruiterStatusEventMessage;
import vn.chuongpl.user_service.dtos.request.QuotaDeltaRequest;
import vn.chuongpl.user_service.dtos.request.RecruiterRequest;
import vn.chuongpl.user_service.dtos.request.RecruiterStatusRequest;
import vn.chuongpl.user_service.dtos.response.RecruiterProfileResponse;
import vn.chuongpl.user_service.dtos.response.RecruiterPublicResponse;
import vn.chuongpl.user_service.dtos.response.RecruiterResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.enums.RecruiterStatus;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.candidate.S3Service;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;
import vn.chuongpl.user_service.integration.notification.AiCreditExhaustedPublisher;


import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class RecruiterService {
    public static final int FREE_TIER_JOB_POST_QUOTA = 10;

    RecruiterRepository recruiterRepository;
    UserRepository userRepository;
    ServicePackageRepository servicePackageRepository;
    RecruiterMapper recruiterMapper;
    S3Service s3Service;
    MongoTemplate mongoTemplate;
    RabbitTemplate rabbitTemplate;
    AiCreditExhaustedPublisher aiCreditExhaustedPublisher;


    public RecruiterResponse create(RecruiterRequest request) {
        User user = userRepository.findById(request.getUserId()).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (recruiterRepository.findByUserIdAndDeletedFalse(request.getUserId()).isPresent()) throw new AppException(ErrorCode.RECRUITER_EXISTED);

        Recruiter recruiter = recruiterMapper.toRecruiter(request);
        if (request.getQuotaJobPost() == null) {
            recruiter.setQuotaJobPost(resolveFreeJobQuota());
        }
        if (request.getQuotaCvViews() == null) {
            recruiter.setQuotaCvViews(resolveFreeCvQuota());
        }
        recruiter.setMonthlyAiCreditsUsed(0);
        recruiter.setMonthlyAiCreditsMonth(currentMonthKey());
        recruiter.setCreatedAt(LocalDateTime.now());
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiter.setDeleted(false);
        initializePlatformFeeSchedule(recruiter, recruiter.getCreatedAt());

        return toRecruiterResponseWithUsage(recruiterRepository.save(recruiter), user);
    }

    public void createBasicProfile(String userId) {
        createBasicProfile(userId, null);
    }

    public void createBasicProfile(String userId, String companyName) {
        var existingRecruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId);
        if (existingRecruiter.isPresent()) {
            Recruiter recruiter = existingRecruiter.get();
            if (companyName != null && !companyName.isBlank() && !Objects.equals(companyName, recruiter.getCompanyName())) {
                recruiter.setCompanyName(companyName);
                recruiter.setUpdatedAt(LocalDateTime.now());
                recruiterRepository.save(recruiter);
            }
            return;
        }
        Recruiter recruiter = Recruiter.builder()
                .userId(userId)
                .companyName(companyName)
                .status(RecruiterStatus.DRAFT)
                .quotaJobPost(resolveFreeJobQuota())
                .quotaCvViews(resolveFreeCvQuota())
                .monthlyAiCreditsUsed(0)
                .monthlyAiCreditsMonth(currentMonthKey())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .deleted(false)
                .build();
        initializePlatformFeeSchedule(recruiter, recruiter.getCreatedAt());
        recruiterRepository.save(recruiter);
    }

    public RecruiterPublicResponse getById(String id) {
        Recruiter recruiter = recruiterRepository.findById(id).filter(r -> !r.isDeleted()).orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        User user = userRepository.findById(recruiter.getUserId()).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        RecruiterPublicResponse response = recruiterMapper.toRecruiterPublicResponse(recruiter, user);
        response.setBusinessLicenseUrl(getFreshLicenseUrl(response.getBusinessLicenseUrl()));
        return response;
    }

    public RecruiterPublicResponse getByUserId(String userId) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId).orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        recruiter = normalizeExpiredPackage(recruiter);
        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        RecruiterPublicResponse response = recruiterMapper.toRecruiterPublicResponse(recruiter, user);
        response.setBusinessLicenseUrl(getFreshLicenseUrl(response.getBusinessLicenseUrl()));
        return response;
    }

    public RecruiterResponse getByUserIdFull(String userId) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId).orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        recruiter = normalizeExpiredPackage(recruiter);
        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return toRecruiterResponseWithUsage(recruiter, user);
    }

    public PageResponse<RecruiterResponse> getAll(int page, int size, RecruiterStatus status, String keyword) {
        int pageCurrent = page > 0 ? page - 1 : 0;
        int safeSize = size > 0 ? size : 10;
        Pageable pageable = PageRequest.of(pageCurrent, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        boolean hasKeyword = keyword != null && !keyword.isBlank();
        if (!hasKeyword) {
            Page<Recruiter> recruiters = status != null
                    ? recruiterRepository.findAllByStatusAndDeletedFalse(status, pageable)
                    : recruiterRepository.findAllByDeletedFalse(pageable);
            return PageResponse.<RecruiterResponse>builder()
                    .items(recruiters.getContent().stream().map(recruiter -> {
                        User user = userRepository.findById(recruiter.getUserId()).orElse(null);
                        return toRecruiterResponseWithUsage(recruiter, user);
                    }).toList())
                    .total(recruiters.getTotalElements())
                    .page(pageCurrent + 1)
                    .pageSize(safeSize)
                    .totalPages(recruiters.getTotalPages())
                    .build();
        }

        List<Criteria> parts = new ArrayList<>();
        parts.add(Criteria.where("deleted").is(false));
        if (status != null) {
            parts.add(Criteria.where("status").is(status));
        }
        parts.add(new Criteria().orOperator(
                Criteria.where("company_name").regex(keyword, "i"),
                Criteria.where("contact_name").regex(keyword, "i")
        ));
        Criteria criteria = new Criteria().andOperator(parts.toArray(new Criteria[0]));
        Query query = Query.query(criteria).with(pageable);
        Query countQuery = Query.query(criteria);
        List<Recruiter> items = mongoTemplate.find(query, Recruiter.class);
        long total = mongoTemplate.count(countQuery, Recruiter.class);
        int totalPages = safeSize > 0 ? (int) Math.ceil((double) total / safeSize) : 1;

        return PageResponse.<RecruiterResponse>builder()
                .items(items.stream().map(recruiter -> {
                    User user = userRepository.findById(recruiter.getUserId()).orElse(null);
                    return toRecruiterResponseWithUsage(recruiter, user);
                }).toList())
                .total(total)
                .page(pageCurrent + 1)
                .pageSize(safeSize)
                .totalPages(totalPages)
                .build();
    }

    public RecruiterResponse update(String id, RecruiterRequest request, String currentUserId, boolean isAdmin) {
        Recruiter recruiter = recruiterRepository.findById(id).filter(r -> !r.isDeleted()).orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        if (!isAdmin && !recruiter.getUserId().equals(currentUserId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        if (!isAdmin && recruiter.getStatus() == RecruiterStatus.PENDING) {
            throw new AppException(ErrorCode.RECRUITER_PROFILE_LOCKED);
        }

        User user = userRepository.findById(recruiter.getUserId()).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        String fixedUserId = recruiter.getUserId();
        recruiterMapper.updateRecruiter(recruiter, request);
        recruiter.setUserId(fixedUserId);

        if (isAdmin) {
            if (request.getStatus() != null) recruiter.setStatus(request.getStatus());
            if (request.getQuotaJobPost() != null) recruiter.setQuotaJobPost(request.getQuotaJobPost());
            if (request.getQuotaCvViews() != null) recruiter.setQuotaCvViews(request.getQuotaCvViews());
        }

        recruiter.setUpdatedAt(LocalDateTime.now());
        return toRecruiterResponseWithUsage(recruiterRepository.save(recruiter), user);
    }

    public RecruiterResponse updateStatus(String id, RecruiterStatusRequest request) {
        Recruiter recruiter = recruiterRepository.findById(id).filter(r -> !r.isDeleted()).orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        User user = userRepository.findById(recruiter.getUserId()).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        recruiter.setStatus(request.getStatus());
        if (request.getStatus() == RecruiterStatus.REJECTED) {
            recruiter.setRejectionNote(request.getRejectionNote());
        } else {
            recruiter.setRejectionNote(null);
        }
        if (request.getQuotaJobPost() != null) recruiter.setQuotaJobPost(request.getQuotaJobPost());
        if (request.getQuotaCvViews() != null) recruiter.setQuotaCvViews(request.getQuotaCvViews());
        recruiter.setUpdatedAt(LocalDateTime.now());

        RecruiterResponse response = toRecruiterResponseWithUsage(recruiterRepository.save(recruiter), user);

        String routingKey = request.getStatus() == RecruiterStatus.APPROVED
                ? RabbitMQConfig.RECRUITER_APPROVED_KEY
                : RabbitMQConfig.RECRUITER_REJECTED_KEY;
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.RECRUITER_EXCHANGE,
                routingKey,
                RecruiterStatusEventMessage.builder()
                        .recruiterId(recruiter.getId())
                        .recruiterEmail(user.getEmail())
                        .contactEmail(recruiter.getContactEmail())
                        .companyName(recruiter.getCompanyName())
                        .status(request.getStatus())
                        .rejectionNote(recruiter.getRejectionNote())
                        .occurredAt(LocalDateTime.now())
                        .build()
        );

        return response;
    }

    public RecruiterResponse submitForApproval(String userId) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));

        if (recruiter.getStatus() != RecruiterStatus.DRAFT && recruiter.getStatus() != RecruiterStatus.REJECTED) {
            throw new AppException(ErrorCode.RECRUITER_INVALID_STATUS_TRANSITION);
        }

        validateProfileComplete(recruiter);

        recruiter.setStatus(RecruiterStatus.PENDING);
        recruiter.setRejectionNote(null);
        recruiter.setUpdatedAt(LocalDateTime.now());

        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        RecruiterResponse response = toRecruiterResponseWithUsage(recruiterRepository.save(recruiter), user);

        List<String> adminIds = userRepository
                .findByRoles_NameIn(List.of("ADMIN"), Pageable.unpaged())
                .stream().map(User::getId).toList();
        if (!adminIds.isEmpty()) {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.RECRUITER_EXCHANGE,
                    RabbitMQConfig.RECRUITER_PENDING_KEY,
                    RecruiterPendingEventMessage.builder()
                            .recruiterId(recruiter.getId())
                            .recruiterEmail(user.getEmail())
                            .companyName(recruiter.getCompanyName())
                            .adminUserIds(adminIds)
                            .occurredAt(LocalDateTime.now())
                            .build()
            );
        }

        return response;
    }

    public RecruiterResponse uploadBusinessLicense(String userId, MultipartFile file) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));

        String url = s3Service.uploadBusinessLicense(file, userId);
        recruiter.setBusinessLicenseUrl(url);
        recruiter.setUpdatedAt(LocalDateTime.now());

        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return toRecruiterResponseWithUsage(recruiterRepository.save(recruiter), user);
    }

    public String uploadLogo(String userId, MultipartFile file) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));

        String url = s3Service.uploadAvatar(file, userId);
        recruiter.setLogoUrl(url);
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiterRepository.save(recruiter);
        return url;
    }

    public String uploadBanner(String userId, MultipartFile file) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));

        String url = s3Service.uploadAvatar(file, userId);
        recruiter.setCoverImageUrl(url);
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiterRepository.save(recruiter);
        return url;
    }

    public RecruiterResponse getMe(String userId) {
        if (recruiterRepository.findByUserIdAndDeletedFalse(userId).isEmpty()) {
            createBasicProfile(userId);
        }
        return getByUserIdFull(userId);
    }

    public String getUserIdByRecruiterId(String recruiterId) {
        return recruiterRepository.findById(recruiterId)
                .filter(r -> !r.isDeleted())
                .map(Recruiter::getUserId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
    }

    public RecruiterProfileResponse getProfile(String userId) {
        Recruiter r = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        r = normalizeExpiredPackage(r);
        return RecruiterProfileResponse.builder()
                .recruiterId(r.getId())
                .userId(r.getUserId())
                .status(r.getStatus())
                .quotaJobPost(r.getQuotaJobPost())
                .quotaCvViews(r.getQuotaCvViews())
                .activePackageId(r.getActivePackageId())
                .packageExpiresAt(r.getPackageExpiresAt())
                .aiCreditsTotal(resolveAiCreditsTotal(r))
                .aiCreditsUsed(resolveCurrentAiCreditsUsed(r.getMonthlyAiCreditsMonth(), r.getMonthlyAiCreditsUsed()))
                .aiCreditsRemaining(resolveRemainingAiCredits(
                        resolveAiCreditsTotal(r),
                        resolveCurrentAiCreditsUsed(r.getMonthlyAiCreditsMonth(), r.getMonthlyAiCreditsUsed())))
                .platformFeeDueAt(r.getPlatformFeeDueAt())
                .platformFeeLastPaidAt(r.getPlatformFeeLastPaidAt())
                .platformFeeReminderSentAt(r.getPlatformFeeReminderSentAt())
                .platformFeeOverdueSentAt(r.getPlatformFeeOverdueSentAt())
                .platformFeeLockedAt(r.getPlatformFeeLockedAt())
                .build();
    }

    public RecruiterProfileResponse addQuota(String userId, QuotaDeltaRequest request) {
        Recruiter r = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        if (r.getQuotaJobPost() != -1) {
            r.setQuotaJobPost(r.getQuotaJobPost() + request.getAddJobPosts());
        }
        if (r.getQuotaCvViews() != -1) {
            r.setQuotaCvViews(r.getQuotaCvViews() + request.getAddCvViews());
        }
        r.setUpdatedAt(LocalDateTime.now());
        Recruiter saved = recruiterRepository.save(r);
        return RecruiterProfileResponse.builder()
                .recruiterId(saved.getId()).userId(saved.getUserId())
                .status(saved.getStatus()).quotaJobPost(saved.getQuotaJobPost()).quotaCvViews(saved.getQuotaCvViews())
                .activePackageId(saved.getActivePackageId())
                .packageExpiresAt(saved.getPackageExpiresAt())
                .aiCreditsTotal(resolveAiCreditsTotal(saved))
                .aiCreditsUsed(resolveCurrentAiCreditsUsed(saved.getMonthlyAiCreditsMonth(), saved.getMonthlyAiCreditsUsed()))
                .aiCreditsRemaining(resolveRemainingAiCredits(
                        resolveAiCreditsTotal(saved),
                        resolveCurrentAiCreditsUsed(saved.getMonthlyAiCreditsMonth(), saved.getMonthlyAiCreditsUsed())))
                .platformFeeDueAt(saved.getPlatformFeeDueAt())
                .platformFeeLastPaidAt(saved.getPlatformFeeLastPaidAt())
                .platformFeeReminderSentAt(saved.getPlatformFeeReminderSentAt())
                .platformFeeOverdueSentAt(saved.getPlatformFeeOverdueSentAt())
                .platformFeeLockedAt(saved.getPlatformFeeLockedAt())
                .build();
    }

    public RecruiterResponse updatePlatformFeePayment(String userId, LocalDateTime paidAt) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        LocalDateTime effectivePaidAt = paidAt != null ? paidAt : LocalDateTime.now();
        recruiter.setPlatformFeeLastPaidAt(effectivePaidAt);
        recruiter.setPlatformFeeDueAt(effectivePaidAt.plusMonths(1));
        recruiter.setPlatformFeeReminderSentAt(null);
        recruiter.setPlatformFeeOverdueSentAt(null);
        recruiter.setPlatformFeeLockedAt(null);
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiterRepository.save(recruiter);

        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (user.isLocked()) {
            user.setLocked(false);
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
        }
        return getByUserIdFull(userId);
    }

    public void markPlatformFeeReminderSent(String userId) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        recruiter.setPlatformFeeReminderSentAt(LocalDateTime.now());
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiterRepository.save(recruiter);
    }

    public void markPlatformFeeOverdueSent(String userId) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        recruiter.setPlatformFeeOverdueSentAt(LocalDateTime.now());
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiterRepository.save(recruiter);
    }

    public void lockForUnpaidPlatformFee(String userId) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        recruiter.setPlatformFeeLockedAt(LocalDateTime.now());
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiterRepository.save(recruiter);

        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        user.setLocked(true);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    public void consumeMonthlyAiCredit(String userId) {
        Recruiter recruiter = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        recruiter = normalizeExpiredPackage(recruiter);

        ServicePackage servicePackage = resolveActivePackage(recruiter.getActivePackageId());
        refreshCreditMonth(recruiter);

        Integer limit = servicePackage.getAiCredits();
        if (limit != null && limit != -1 && recruiter.getMonthlyAiCreditsUsed() >= limit) {
            aiCreditExhaustedPublisher.publish(userId, "RECRUITER");
            throw new AppException(ErrorCode.INSUFFICIENT_AI_QUOTA);
        }


        recruiter.setMonthlyAiCreditsUsed(recruiter.getMonthlyAiCreditsUsed() + 1);
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiterRepository.save(recruiter);
    }

    public void consumeJobQuota(String userId) {
        Recruiter r = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        if (r.getQuotaJobPost() == 0) {
            throw new AppException(ErrorCode.INSUFFICIENT_QUOTA);
        }
        if (r.getQuotaJobPost() != -1) {
            r.setQuotaJobPost(r.getQuotaJobPost() - 1);
            r.setUpdatedAt(LocalDateTime.now());
            recruiterRepository.save(r);
        }
    }

    public void refundJobQuota(String userId) {
        Recruiter r = recruiterRepository.findByUserIdAndDeletedFalse(userId)
                .orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        if (r.getQuotaJobPost() != -1) {
            r.setQuotaJobPost(r.getQuotaJobPost() + 1);
            r.setUpdatedAt(LocalDateTime.now());
            recruiterRepository.save(r);
        }
    }

    public void delete(String id) {
        Recruiter recruiter = recruiterRepository.findById(id).filter(r -> !r.isDeleted()).orElseThrow(() -> new AppException(ErrorCode.RECRUITER_NOT_FOUND));
        recruiter.setDeleted(true);
        recruiter.setDeletedAt(LocalDateTime.now());
        recruiter.setUpdatedAt(LocalDateTime.now());
        recruiterRepository.save(recruiter);
    }

    private void validateProfileComplete(Recruiter r) {
        if (isBlank(r.getCompanyName()) || isBlank(r.getTaxCode()) ||
                isBlank(r.getCompanyAddress()) || isBlank(r.getCompanyCity()) ||
                isBlank(r.getIndustry()) || isBlank(r.getCompanyType()) ||
                isBlank(r.getCompanySize()) || isBlank(r.getBusinessLicenseUrl())) {
            throw new AppException(ErrorCode.RECRUITER_PROFILE_INCOMPLETE);
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private ServicePackage resolveActivePackage(String activePackageId) {
        String packageId = activePackageId == null || activePackageId.isBlank() ? "free" : activePackageId;
        return servicePackageRepository.findById(packageId)
                .orElseGet(() -> servicePackageRepository.findById("free")
                        .orElseThrow(() -> new AppException(ErrorCode.SERVICE_PACKAGE_NOT_FOUND)));
    }

    private void refreshCreditMonth(Recruiter recruiter) {
        String currentMonth = currentMonthKey();
        if (!currentMonth.equals(recruiter.getMonthlyAiCreditsMonth())) {
            recruiter.setMonthlyAiCreditsUsed(0);
            recruiter.setMonthlyAiCreditsMonth(currentMonth);
        }
    }

    private String currentMonthKey() {
        return YearMonth.now().toString();
    }

    private Integer resolveAiCreditsTotal(Recruiter recruiter) {
        String packageId = recruiter.getActivePackageId() == null || recruiter.getActivePackageId().isBlank()
                ? "free"
                : recruiter.getActivePackageId();
        return servicePackageRepository.findById(packageId)
                .or(() -> servicePackageRepository.findById("free"))
                .map(ServicePackage::getAiCredits)
                .orElse(null);
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

    private void initializePlatformFeeSchedule(Recruiter recruiter, LocalDateTime baseTime) {
        LocalDateTime createdAt = baseTime != null ? baseTime : LocalDateTime.now();
        recruiter.setPlatformFeeDueAt(createdAt.plusMonths(1));
        recruiter.setPlatformFeeLastPaidAt(null);
        recruiter.setPlatformFeeReminderSentAt(null);
        recruiter.setPlatformFeeLockedAt(null);
    }

    public void downgradeToFree(String userId) {
        recruiterRepository.findByUserIdAndDeletedFalse(userId).ifPresent(recruiter -> {
            if ("free".equalsIgnoreCase(recruiter.getActivePackageId())) {
                return;
            }
            LocalDateTime now = LocalDateTime.now();
            recruiter.setActivePackageId("free");
            recruiter.setPackageActivatedAt(null);
            recruiter.setPackageExpiresAt(null);
            recruiter.setQuotaJobPost(resolveFreeJobQuota());
            recruiter.setQuotaCvViews(resolveFreeCvQuota());
            recruiter.setMonthlyAiCreditsUsed(0);
            recruiter.setMonthlyAiCreditsMonth(currentMonthKey());
            recruiter.setPackageDowngradedAt(now);
            recruiter.setPostExpiryCleanupAt(null);
            recruiter.setUpdatedAt(now);
            recruiterRepository.save(recruiter);
        });
    }

    private Recruiter normalizeExpiredPackage(Recruiter recruiter) {
        if (recruiter.getPackageExpiresAt() == null) {
            return recruiter;
        }
        if (recruiter.getPackageExpiresAt().isAfter(LocalDateTime.now())) {
            return recruiter;
        }
        if ("free".equalsIgnoreCase(recruiter.getActivePackageId())) {
            return recruiter;
        }

        recruiter.setActivePackageId("free");
        recruiter.setPackageActivatedAt(null);
        recruiter.setPackageExpiresAt(null);
        recruiter.setQuotaJobPost(resolveFreeJobQuota());
        recruiter.setQuotaCvViews(resolveFreeCvQuota());
        recruiter.setMonthlyAiCreditsUsed(0);
        recruiter.setMonthlyAiCreditsMonth(currentMonthKey());
        recruiter.setUpdatedAt(LocalDateTime.now());
        return recruiterRepository.save(recruiter);
    }

    private int resolveFreeJobQuota() {
        return servicePackageRepository.findById("free")
                .map(ServicePackage::getJobLimit)
                .filter(limit -> limit != null)
                .orElse(FREE_TIER_JOB_POST_QUOTA);
    }

    private int resolveFreeCvQuota() {
        return servicePackageRepository.findById("free")
                .map(ServicePackage::getCvLimit)
                .filter(limit -> limit != null)
                .orElse(0);
    }

    private RecruiterResponse toRecruiterResponseWithUsage(Recruiter recruiter, User user) {
        RecruiterResponse response = recruiterMapper.toRecruiterResponse(recruiter, user);
        response.setBusinessLicenseUrl(getFreshLicenseUrl(response.getBusinessLicenseUrl()));
        Integer total = resolveAiCreditsTotal(recruiter);
        int used = resolveCurrentAiCreditsUsed(recruiter.getMonthlyAiCreditsMonth(), recruiter.getMonthlyAiCreditsUsed());
        response.setAiCreditsTotal(total);
        response.setAiCreditsUsed(used);
        response.setAiCreditsRemaining(resolveRemainingAiCredits(total, used));
        return response;
    }

    private String getFreshLicenseUrl(String storedUrl) {
        if (storedUrl == null || storedUrl.isBlank()) {
            return storedUrl;
        }
        int idx = storedUrl.indexOf("recruiters/");
        if (idx == -1) {
            return storedUrl;
        }
        String key = storedUrl.substring(idx);
        if (key.contains("?")) {
            key = key.substring(0, key.indexOf("?"));
        }
        try {
            return s3Service.generatePresignedUrl(key);
        } catch (Exception e) {
            return storedUrl;
        }
    }
}
