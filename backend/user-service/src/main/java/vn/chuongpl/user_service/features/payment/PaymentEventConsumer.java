package vn.chuongpl.user_service.features.payment;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.recruiter.Recruiter;
import vn.chuongpl.user_service.features.recruiter.RecruiterRepository;
import vn.chuongpl.user_service.features.recruiter.RecruiterService;

import java.time.LocalDateTime;
import java.time.YearMonth;

@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class PaymentEventConsumer {

    RecruiterRepository recruiterRepository;
    CandidateRepository candidateRepository;
    RecruiterService recruiterService;

    @RabbitListener(queues = RabbitMQConfig.PAYMENT_COMPLETED_QUEUE)
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        try {
            if ("RECRUITER".equals(event.getUserRole())) {
                activateForRecruiter(event);
            } else if ("CANDIDATE".equals(event.getUserRole())) {
                activateForCandidate(event);
            } else {
                log.warn("[Payment] Unknown userRole={} for userId={}", event.getUserRole(), event.getUserId());
            }
        } catch (Exception e) {
            log.error("[Payment] Failed to activate package for userId={} orderId={}: {}",
                    event.getUserId(), event.getOrderId(), e.getMessage());
            // Rethrow so Spring AMQP NACKs the message → routes to DLQ after retries
            throw new RuntimeException("Failed to process payment event", e);
        }
    }

    private void activateForRecruiter(PaymentCompletedEvent event) {
        if ("fee".equalsIgnoreCase(event.getPackageId())) {
            recruiterService.updatePlatformFeePayment(event.getUserId(), event.getPaidAt());
            log.info("[Payment] Platform fee payment recorded for recruiter userId={}", event.getUserId());
            return;
        }
        recruiterRepository.findByUserIdAndDeletedFalse(event.getUserId())
                .ifPresentOrElse(recruiter -> {
                    if (event.getOrderId().equals(recruiter.getLastPaymentOrderId())) {
                        log.info("[Payment] Duplicate event orderId={} for recruiter userId={}, skipping",
                                event.getOrderId(), event.getUserId());
                        return;
                    }
                    setActivationFields(recruiter, event);
                    applyRecruiterQuota(recruiter, event);
                    recruiter.setLastPaymentOrderId(event.getOrderId());
                    recruiter.setUpdatedAt(LocalDateTime.now());
                    recruiterRepository.save(recruiter);
                    log.info("[Payment] Package {} activated for recruiter userId={}", event.getPackageId(), event.getUserId());
                }, () -> log.warn("[Payment] Recruiter not found for userId={}", event.getUserId()));
    }

    private void activateForCandidate(PaymentCompletedEvent event) {
        if ("fee".equalsIgnoreCase(event.getPackageId())) {
            return;
        }
        candidateRepository.findByUserIdAndDeletedFalse(event.getUserId())
                .ifPresentOrElse(candidate -> {
                    if (event.getOrderId().equals(candidate.getLastPaymentOrderId())) {
                        log.info("[Payment] Duplicate event orderId={} for candidate userId={}, skipping",
                                event.getOrderId(), event.getUserId());
                        return;
                    }
                    setActivationFields(candidate, event);
                    candidate.setLastPaymentOrderId(event.getOrderId());
                    candidate.setUpdatedAt(LocalDateTime.now());
                    candidateRepository.save(candidate);
                    log.info("[Payment] Package {} activated for candidate userId={}", event.getPackageId(), event.getUserId());
                }, () -> log.warn("[Payment] Candidate not found for userId={}", event.getUserId()));
    }

    private void setActivationFields(Recruiter recruiter, PaymentCompletedEvent event) {
        recruiter.setActivePackageId(event.getPackageId());
        recruiter.setPackageActivatedAt(event.getPaidAt());
        recruiter.setPackageExpiresAt(computeExpiry(event));
        resetAiCreditBucket(recruiter, event.getPaidAt());
    }

    private void setActivationFields(Candidate candidate, PaymentCompletedEvent event) {
        candidate.setActivePackageId(event.getPackageId());
        candidate.setPackageActivatedAt(event.getPaidAt());
        candidate.setPackageExpiresAt(computeExpiry(event));
        resetAiCreditBucket(candidate, event.getPaidAt());
    }

    private void applyRecruiterQuota(Recruiter recruiter, PaymentCompletedEvent event) {
        Integer jobLimit = event.getPackageJobLimit();
        Integer cvLimit = event.getPackageCvLimit();

        if (jobLimit != null) {
            if (jobLimit == -1) {
                recruiter.setQuotaJobPost(-1);
            } else {
                int current = recruiter.getQuotaJobPost();
                recruiter.setQuotaJobPost(current == -1 ? -1 : current + jobLimit);
            }
        }

        if (cvLimit != null) {
            if (cvLimit == -1) {
                recruiter.setQuotaCvViews(-1);
            } else {
                int current = recruiter.getQuotaCvViews();
                recruiter.setQuotaCvViews(current == -1 ? -1 : current + cvLimit);
            }
        }
    }

    private LocalDateTime computeExpiry(PaymentCompletedEvent event) {
        if (event.getPackageDurationDays() == null || event.getPaidAt() == null) {
            return null;
        }
        return event.getPaidAt().plusDays(event.getPackageDurationDays());
    }

    private void resetAiCreditBucket(Recruiter recruiter, LocalDateTime referenceTime) {
        recruiter.setMonthlyAiCreditsUsed(0);
        recruiter.setMonthlyAiCreditsMonth(resolveMonthKey(referenceTime));
    }

    private void resetAiCreditBucket(Candidate candidate, LocalDateTime referenceTime) {
        candidate.setMonthlyAiCreditsUsed(0);
        candidate.setMonthlyAiCreditsMonth(resolveMonthKey(referenceTime));
    }

    private String resolveMonthKey(LocalDateTime referenceTime) {
        LocalDateTime effectiveTime = referenceTime != null ? referenceTime : LocalDateTime.now();
        return YearMonth.from(effectiveTime).toString();
    }
}
