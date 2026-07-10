package vn.chuongpl.user_service.features.cron;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;
import vn.chuongpl.user_service.dtos.message.PackageExpiredEventMessage;
import vn.chuongpl.user_service.dtos.message.PackageExpiringSoonEventMessage;
import vn.chuongpl.user_service.dtos.message.RecruiterBillingEventMessage;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.recruiter.Recruiter;
import vn.chuongpl.user_service.features.recruiter.RecruiterService;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;
import vn.chuongpl.user_service.integration.job.JobClient;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionExpiryScheduler {

    private static final int PACKAGE_EXPIRY_WARNING_DAYS = 3;
    private static final int GRACE_PERIOD_DAYS = 3;
    private static final int PLATFORM_FEE_REMINDER_DAYS = 7;
    private static final int PLATFORM_FEE_OVERDUE_DAYS = 3;
    private static final int PLATFORM_FEE_LOCK_DAYS = 7;
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final RecruiterService recruiterService;
    private final CandidateService candidateService;
    private final UserRepository userRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final JobClient jobClient;
    private final MongoTemplate mongoTemplate;
    private final RabbitTemplate rabbitTemplate;

    @Scheduled(cron = "0 0 2 * * *")
    public void runDailySubscriptionCheck() {
        log.info("[Cron] Daily subscription check started");
        runExpiryCheck();
        cleanupAfterGracePeriod(GRACE_PERIOD_DAYS);
        checkPlatformFees();
        log.info("[Cron] Daily subscription check completed");
    }

    public void runExpiryCheck() {
        resetExpiredPackages();
        warnExpiringPackages();
    }

    public void runGracePeriodCleanup(int graceDays) {
        cleanupAfterGracePeriod(graceDays);
    }

    // ── Package expiry reset ──────────────────────────────────────────────────

    private void resetExpiredPackages() {
        LocalDateTime now = LocalDateTime.now();
        Criteria expiredPkg = buildExpiredPackageCriteria(now);

        List<Recruiter> expiredRecruiters = mongoTemplate.find(
                Query.query(expiredPkg.andOperator(Criteria.where("deleted").is(false))),
                Recruiter.class
        );
        log.info("[Cron] Recruiters with expired packages: {}", expiredRecruiters.size());
        for (Recruiter r : expiredRecruiters) {
            try {
                String packageId = r.getActivePackageId();
                String expiredAt = r.getPackageExpiresAt().format(FMT);
                String email = resolveEmail(r.getUserId());
                recruiterService.downgradeToFree(r.getUserId());
                publishPackageExpired(r.getUserId(), email, "RECRUITER", packageId, expiredAt);
                log.info("[Cron] Reset expired package for recruiter userId={}", r.getUserId());
            } catch (Exception e) {
                log.error("[Cron] Failed to reset package for recruiter userId={}: {}", r.getUserId(), e.getMessage());
            }
        }

        List<Candidate> expiredCandidates = mongoTemplate.find(
                Query.query(expiredPkg.andOperator(Criteria.where("deleted").is(false))),
                Candidate.class
        );
        log.info("[Cron] Candidates with expired packages: {}", expiredCandidates.size());
        for (Candidate c : expiredCandidates) {
            try {
                String packageId = c.getActivePackageId();
                String expiredAt = c.getPackageExpiresAt().format(FMT);
                String email = resolveEmail(c.getUserId());
                candidateService.downgradeToFree(c.getUserId());
                publishPackageExpired(c.getUserId(), email, "CANDIDATE", packageId, expiredAt);
                log.info("[Cron] Reset expired package for candidate userId={}", c.getUserId());
            } catch (Exception e) {
                log.error("[Cron] Failed to reset package for candidate userId={}: {}", c.getUserId(), e.getMessage());
            }
        }
    }

    // ── Package expiry warning ────────────────────────────────────────────────

    private void warnExpiringPackages() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime warningDeadline = now.plusDays(PACKAGE_EXPIRY_WARNING_DAYS);

        Criteria expiringSoon = new Criteria().andOperator(
                Criteria.where("package_expires_at").gt(now).lte(warningDeadline),
                Criteria.where("active_package_id").nin(null, "", "free"),
                Criteria.where("package_expiry_warning_sent_at").is(null)
        );

        List<Recruiter> expiringSoonRecruiters = mongoTemplate.find(
                Query.query(expiringSoon.andOperator(Criteria.where("deleted").is(false))),
                Recruiter.class
        );
        log.info("[Cron] Recruiters with packages expiring in {}d: {}", PACKAGE_EXPIRY_WARNING_DAYS, expiringSoonRecruiters.size());
        for (Recruiter r : expiringSoonRecruiters) {
            try {
                String email = resolveEmail(r.getUserId());
                String expiresAt = r.getPackageExpiresAt().format(FMT);
                publishPackageExpiringSoon(r.getUserId(), email, "RECRUITER", r.getActivePackageId(), expiresAt);
                r.setPackageExpiryWarningSentAt(now);
                r.setUpdatedAt(now);
                mongoTemplate.save(r);
                log.info("[Cron] Warning sent for expiring package: recruiter userId={}", r.getUserId());
            } catch (Exception e) {
                log.error("[Cron] Failed to warn expiring package for recruiter userId={}: {}", r.getUserId(), e.getMessage());
            }
        }

        List<Candidate> expiringSoonCandidates = mongoTemplate.find(
                Query.query(expiringSoon.andOperator(Criteria.where("deleted").is(false))),
                Candidate.class
        );
        log.info("[Cron] Candidates with packages expiring in {}d: {}", PACKAGE_EXPIRY_WARNING_DAYS, expiringSoonCandidates.size());
        for (Candidate c : expiringSoonCandidates) {
            try {
                String email = resolveEmail(c.getUserId());
                String expiresAt = c.getPackageExpiresAt().format(FMT);
                publishPackageExpiringSoon(c.getUserId(), email, "CANDIDATE", c.getActivePackageId(), expiresAt);
                c.setPackageExpiryWarningSentAt(now);
                c.setUpdatedAt(now);
                mongoTemplate.save(c);
                log.info("[Cron] Warning sent for expiring package: candidate userId={}", c.getUserId());
            } catch (Exception e) {
                log.error("[Cron] Failed to warn expiring package for candidate userId={}: {}", c.getUserId(), e.getMessage());
            }
        }
    }

    // ── Grace period cleanup ──────────────────────────────────────────────────

    private void cleanupAfterGracePeriod(int graceDays) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime graceCutoff = now.minusDays(graceDays);

        ServicePackage freePkg = servicePackageRepository.findById("free").orElse(null);
        int freeJobLimit = (freePkg != null && freePkg.getJobLimit() != null) ? freePkg.getJobLimit() : 5;
        int freeCvLimit = (freePkg != null && freePkg.getCvLimit() != null) ? freePkg.getCvLimit() : 3;

        Criteria gracePeriodExpired = new Criteria().andOperator(
                Criteria.where("active_package_id").is("free"),
                Criteria.where("package_downgraded_at").lt(graceCutoff),
                Criteria.where("post_expiry_cleanup_at").is(null),
                Criteria.where("deleted").is(false)
        );

        // Recruiter: deactivate excess active jobs via job-service
        List<Recruiter> recruitersToClean = mongoTemplate.find(Query.query(gracePeriodExpired), Recruiter.class);
        log.info("[Cron] Recruiters past grace period for job cleanup: {}", recruitersToClean.size());
        for (Recruiter r : recruitersToClean) {
            try {
                int deactivated = jobClient.deactivateExcessActiveJobs(r.getId(), freeJobLimit);
                r.setPostExpiryCleanupAt(now);
                r.setUpdatedAt(now);
                mongoTemplate.save(r);
                log.info("[Cron] Job cleanup done for recruiter={}, deactivated={}", r.getUserId(), deactivated);
            } catch (Exception e) {
                log.error("[Cron] Job cleanup failed for recruiter={}: {}", r.getUserId(), e.getMessage());
            }
        }

        // Candidate: delete excess CVs, keep oldest freeCvLimit (default always kept)
        List<Candidate> candidatesToClean = mongoTemplate.find(Query.query(gracePeriodExpired), Candidate.class);
        log.info("[Cron] Candidates past grace period for CV cleanup: {}", candidatesToClean.size());
        for (Candidate c : candidatesToClean) {
            try {
                deleteExcessCvs(c, freeCvLimit, now);
                c.setPostExpiryCleanupAt(now);
                c.setUpdatedAt(now);
                mongoTemplate.save(c);
                log.info("[Cron] CV cleanup done for candidate={}", c.getUserId());
            } catch (Exception e) {
                log.error("[Cron] CV cleanup failed for candidate={}: {}", c.getUserId(), e.getMessage());
            }
        }
    }

    private void deleteExcessCvs(Candidate candidate, int limit, LocalDateTime now) {
        List<vn.chuongpl.user_service.features.candidate.CvItem> cvs = candidate.getCvs();
        if (cvs == null || cvs.size() <= limit) return;

        // Sort: default first, then by uploadedAt ascending (oldest first = keep)
        // Keep the default + oldest non-default up to limit; remove the newest excess
        List<vn.chuongpl.user_service.features.candidate.CvItem> toKeep = cvs.stream()
                .sorted(Comparator
                        .comparingInt((vn.chuongpl.user_service.features.candidate.CvItem cv) -> cv.isDefault() ? 0 : 1)
                        .thenComparing(vn.chuongpl.user_service.features.candidate.CvItem::getUploadedAt))
                .limit(limit)
                .toList();

        int removed = cvs.size() - toKeep.size();
        candidate.getCvs().retainAll(toKeep);
        log.info("[Cron] Removed {} excess CVs for candidate={}", removed, candidate.getUserId());
    }

    // ── Platform fee ──────────────────────────────────────────────────────────

    private void checkPlatformFees() {
        LocalDateTime now = LocalDateTime.now();

        // Approaching: due within PLATFORM_FEE_REMINDER_DAYS and no reminder sent yet
        List<Recruiter> approaching = mongoTemplate.find(Query.query(new Criteria().andOperator(
                Criteria.where("platform_fee_due_at").gt(now).lte(now.plusDays(PLATFORM_FEE_REMINDER_DAYS)),
                Criteria.where("platform_fee_reminder_sent_at").is(null),
                Criteria.where("deleted").is(false)
        )), Recruiter.class);
        log.info("[Cron] Recruiters approaching platform fee deadline: {}", approaching.size());
        for (Recruiter r : approaching) {
            try {
                String email = resolveEmail(r.getUserId());
                String dueAt = r.getPlatformFeeDueAt().format(FMT);
                publishRecruiterBilling(r, email, "FEE_APPROACHING", dueAt, null);
                recruiterService.markPlatformFeeReminderSent(r.getUserId());
                log.info("[Cron] Platform fee reminder sent for recruiter userId={}", r.getUserId());
            } catch (Exception e) {
                log.error("[Cron] Failed to send platform fee reminder for recruiter userId={}: {}", r.getUserId(), e.getMessage());
            }
        }

        // Overdue: past due by PLATFORM_FEE_OVERDUE_DAYS and no overdue notice sent
        List<Recruiter> overdue = mongoTemplate.find(Query.query(new Criteria().andOperator(
                Criteria.where("platform_fee_due_at").lt(now.minusDays(PLATFORM_FEE_OVERDUE_DAYS)),
                Criteria.where("platform_fee_overdue_sent_at").is(null),
                Criteria.where("platform_fee_locked_at").is(null),
                Criteria.where("deleted").is(false)
        )), Recruiter.class);
        log.info("[Cron] Recruiters overdue on platform fee: {}", overdue.size());
        for (Recruiter r : overdue) {
            try {
                String email = resolveEmail(r.getUserId());
                String dueAt = r.getPlatformFeeDueAt().format(FMT);
                publishRecruiterBilling(r, email, "FEE_OVERDUE", dueAt, null);
                recruiterService.markPlatformFeeOverdueSent(r.getUserId());
                log.info("[Cron] Platform fee overdue notice sent for recruiter userId={}", r.getUserId());
            } catch (Exception e) {
                log.error("[Cron] Failed to send overdue notice for recruiter userId={}: {}", r.getUserId(), e.getMessage());
            }
        }

        // Lock: past due by PLATFORM_FEE_LOCK_DAYS and not yet locked
        List<Recruiter> toLock = mongoTemplate.find(Query.query(new Criteria().andOperator(
                Criteria.where("platform_fee_due_at").lt(now.minusDays(PLATFORM_FEE_LOCK_DAYS)),
                Criteria.where("platform_fee_locked_at").is(null),
                Criteria.where("deleted").is(false)
        )), Recruiter.class);
        log.info("[Cron] Recruiters to lock for unpaid platform fee: {}", toLock.size());
        for (Recruiter r : toLock) {
            try {
                String email = resolveEmail(r.getUserId());
                String dueAt = r.getPlatformFeeDueAt().format(FMT);
                String lockedAt = now.format(FMT);
                recruiterService.lockForUnpaidPlatformFee(r.getUserId());
                publishRecruiterBilling(r, email, "FEE_LOCKED", dueAt, lockedAt);
                log.info("[Cron] Account locked for unpaid platform fee: recruiter userId={}", r.getUserId());
            } catch (Exception e) {
                log.error("[Cron] Failed to lock recruiter userId={}: {}", r.getUserId(), e.getMessage());
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Criteria buildExpiredPackageCriteria(LocalDateTime now) {
        return new Criteria().andOperator(
                Criteria.where("package_expires_at").lt(now),
                Criteria.where("active_package_id").nin(null, "", "free")
        );
    }

    private String resolveEmail(String userId) {
        return userRepository.findById(userId)
                .map(User::getEmail)
                .orElse(null);
    }

    private void publishPackageExpired(String userId, String email, String role, String packageId, String expiredAt) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.RECRUITER_EXCHANGE,
                RabbitMQConfig.PACKAGE_EXPIRED_KEY,
                PackageExpiredEventMessage.builder()
                        .userId(userId)
                        .userEmail(email)
                        .userRole(role)
                        .packageId(packageId)
                        .expiredAt(expiredAt)
                        .build()
        );
    }

    private void publishPackageExpiringSoon(String userId, String email, String role, String packageId, String expiresAt) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.RECRUITER_EXCHANGE,
                RabbitMQConfig.PACKAGE_EXPIRING_SOON_KEY,
                PackageExpiringSoonEventMessage.builder()
                        .userId(userId)
                        .userEmail(email)
                        .userRole(role)
                        .packageId(packageId)
                        .expiresAt(expiresAt)
                        .build()
        );
    }

    private void publishRecruiterBilling(Recruiter r, String email, String eventType, String dueAt, String lockedAt) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.RECRUITER_EXCHANGE,
                RabbitMQConfig.RECRUITER_BILLING_KEY,
                RecruiterBillingEventMessage.builder()
                        .recruiterId(r.getId())
                        .recruiterUserId(r.getUserId())
                        .recruiterEmail(email)
                        .companyName(r.getCompanyName())
                        .eventType(eventType)
                        .dueAt(dueAt)
                        .lockedAt(lockedAt)
                        .amount("")
                        .build()
        );
    }
}
