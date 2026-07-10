package vn.chuongpl.user_service.features.recruiter;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class PlatformFeeScheduler {

    static final int APPROACHING_DAYS_BEFORE = 7;
    static final int LOCK_DAYS_AFTER = 3;

    MongoTemplate mongoTemplate;
    RecruiterService recruiterService;
    RabbitTemplate rabbitTemplate;
    UserRepository userRepository;
    CandidateRepository candidateRepository;

    // Runs at 02:00 every day
    @Scheduled(cron = "0 0 2 * * *")
    public void runDailyBillingJobs() {
        LocalDateTime now = LocalDateTime.now();
        log.info("[Billing] Daily billing job started at {}", now);
        processPlatformFeeState(now);
        processExpiredServicePackages(now);
        log.info("[Billing] Daily billing job completed");
    }

    // ── Platform fee phase logic ──────────────────────────────────────────────

    private void processPlatformFeeState(LocalDateTime now) {
        List<Recruiter> recruiters = mongoTemplate.find(
                Query.query(Criteria.where("deleted").is(false)),
                Recruiter.class
        );

        for (Recruiter recruiter : recruiters) {
            if (recruiter.getPlatformFeeDueAt() == null || recruiter.getUserId() == null) {
                continue;
            }
            if (recruiter.getPlatformFeeLockedAt() != null) {
                continue;
            }

            LocalDateTime dueAt = recruiter.getPlatformFeeDueAt();

            // Phase 1: approaching — 7 days before due, reminder not yet sent
            if (dueAt.isAfter(now) && !dueAt.minusDays(APPROACHING_DAYS_BEFORE).isAfter(now)
                    && recruiter.getPlatformFeeReminderSentAt() == null) {
                sendBillingEvent(recruiter, "FEE_APPROACHING", now);
                recruiterService.markPlatformFeeReminderSent(recruiter.getUserId());
                log.info("[Billing] Sent FEE_APPROACHING for userId={}", recruiter.getUserId());
                continue;
            }

            // Phase 2: overdue — due date passed, overdue notice not yet sent
            if (!dueAt.isAfter(now) && recruiter.getPlatformFeeOverdueSentAt() == null) {
                sendBillingEvent(recruiter, "FEE_OVERDUE", now);
                recruiterService.markPlatformFeeOverdueSent(recruiter.getUserId());
                log.info("[Billing] Sent FEE_OVERDUE for userId={}", recruiter.getUserId());
                continue;
            }

            // Phase 3: lock — 3 days past due date
            if (!dueAt.plusDays(LOCK_DAYS_AFTER).isAfter(now)) {
                sendBillingEvent(recruiter, "FEE_LOCKED", now);
                recruiterService.lockForUnpaidPlatformFee(recruiter.getUserId());
                log.info("[Billing] Locked account for userId={}", recruiter.getUserId());
            }
        }
    }

    private void sendBillingEvent(Recruiter recruiter, String eventType, LocalDateTime now) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("eventType", eventType);
        payload.put("recruiterId", recruiter.getId());
        payload.put("recruiterUserId", recruiter.getUserId());
        payload.put("recruiterEmail", recruiter.getContactEmail() != null ? recruiter.getContactEmail() : "");
        payload.put("companyName", recruiter.getCompanyName() != null ? recruiter.getCompanyName() : "");
        payload.put("dueAt", recruiter.getPlatformFeeDueAt().toString());
        payload.put("lockedAt", "FEE_LOCKED".equals(eventType) ? now.toString() : "");
        payload.put("amount", "10000");
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.RECRUITER_EXCHANGE,
                RabbitMQConfig.RECRUITER_BILLING_KEY,
                payload
        );
    }

    // ── Expired service package downgrade ─────────────────────────────────────

    private void processExpiredServicePackages(LocalDateTime now) {
        processExpiredRecruiterPackages(now);
        processExpiredCandidatePackages(now);
    }

    private void processExpiredRecruiterPackages(LocalDateTime now) {
        List<Recruiter> expired = mongoTemplate.find(
                Query.query(
                        Criteria.where("deleted").is(false)
                                .and("package_expires_at").lte(now)
                                .and("active_package_id").ne(null).ne("free")
                ),
                Recruiter.class
        );
        if (expired.isEmpty()) {
            return;
        }
        log.info("[Billing] Found {} recruiter(s) with expired packages", expired.size());
        for (Recruiter recruiter : expired) {
            try {
                recruiterService.downgradeToFree(recruiter.getUserId());
                String email = resolveRecruiterEmail(recruiter);
                if (email != null && !email.isBlank()) {
                    sendPackageExpiredEvent(recruiter.getUserId(), email, "RECRUITER",
                            recruiter.getActivePackageId(), recruiter.getPackageExpiresAt());
                }
                log.info("[Billing] Downgraded expired package for recruiter userId={}", recruiter.getUserId());
            } catch (Exception e) {
                log.error("[Billing] Failed to downgrade recruiter userId={}: {}", recruiter.getUserId(), e.getMessage());
            }
        }
    }

    private void processExpiredCandidatePackages(LocalDateTime now) {
        List<Candidate> expired = mongoTemplate.find(
                Query.query(
                        Criteria.where("deleted").is(false)
                                .and("package_expires_at").lte(now)
                                .and("active_package_id").ne(null).ne("free")
                ),
                Candidate.class
        );
        if (expired.isEmpty()) {
            return;
        }
        log.info("[Billing] Found {} candidate(s) with expired packages", expired.size());
        for (Candidate candidate : expired) {
            try {
                String email = resolveUserEmail(candidate.getUserId());
                candidate.setActivePackageId("free");
                candidate.setPackageActivatedAt(null);
                candidate.setPackageExpiresAt(null);
                candidate.setUpdatedAt(now);
                candidateRepository.save(candidate);
                if (email != null && !email.isBlank()) {
                    sendPackageExpiredEvent(candidate.getUserId(), email, "CANDIDATE",
                            candidate.getActivePackageId(), candidate.getPackageExpiresAt());
                }
                log.info("[Billing] Downgraded expired package for candidate userId={}", candidate.getUserId());
            } catch (Exception e) {
                log.error("[Billing] Failed to downgrade candidate userId={}: {}", candidate.getUserId(), e.getMessage());
            }
        }
    }

    private void sendPackageExpiredEvent(String userId, String email, String role,
                                         String packageId, LocalDateTime expiredAt) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        payload.put("userEmail", email);
        payload.put("userRole", role);
        payload.put("packageId", packageId != null ? packageId : "");
        payload.put("expiredAt", expiredAt != null ? expiredAt.toString() : "");
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.RECRUITER_EXCHANGE,
                RabbitMQConfig.PACKAGE_EXPIRED_KEY,
                payload
        );
    }

    private String resolveRecruiterEmail(Recruiter recruiter) {
        if (recruiter.getContactEmail() != null && !recruiter.getContactEmail().isBlank()) {
            return recruiter.getContactEmail();
        }
        return resolveUserEmail(recruiter.getUserId());
    }

    private String resolveUserEmail(String userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId).map(User::getEmail).orElse(null);
    }
}
