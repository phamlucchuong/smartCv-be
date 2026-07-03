package vn.chuongpl.user_service.features.payment;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.recruiter.Recruiter;
import vn.chuongpl.user_service.features.recruiter.RecruiterRepository;
import vn.chuongpl.user_service.features.recruiter.RecruiterService;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentEventConsumerTest {

    @Mock RecruiterRepository recruiterRepository;
    @Mock CandidateRepository candidateRepository;
    @Mock RecruiterService recruiterService;

    PaymentEventConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new PaymentEventConsumer(recruiterRepository, candidateRepository, recruiterService);
    }

    @Test
    void handlePaymentCompleted_recruiter_setsActivationFieldsAndQuota() {
        Recruiter recruiter = Recruiter.builder()
                .userId("u1").quotaJobPost(5).quotaCvViews(3)
                .monthlyAiCreditsUsed(9)
                .monthlyAiCreditsMonth("2026-06")
                .build();
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1"))
                .thenReturn(Optional.of(recruiter));

        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .userId("u1").userRole("RECRUITER")
                .packageId("plus").packageName("Plus")
                .packageJobLimit(10).packageCvLimit(20)
                .packageAiCredits(15).packageDurationDays(30)
                .orderId("ord1")
                .paidAt(LocalDateTime.of(2026, 6, 25, 10, 0))
                .build();

        consumer.handlePaymentCompleted(event);

        ArgumentCaptor<Recruiter> captor = ArgumentCaptor.forClass(Recruiter.class);
        verify(recruiterRepository).save(captor.capture());
        Recruiter saved = captor.getValue();

        assertThat(saved.getActivePackageId()).isEqualTo("plus");
        assertThat(saved.getPackageActivatedAt()).isEqualTo(LocalDateTime.of(2026, 6, 25, 10, 0));
        assertThat(saved.getPackageExpiresAt()).isEqualTo(LocalDateTime.of(2026, 7, 25, 10, 0));
        assertThat(saved.getQuotaJobPost()).isEqualTo(15);  // 5 existing + 10 package
        assertThat(saved.getQuotaCvViews()).isEqualTo(23);  // 3 existing + 20 package
        assertThat(saved.getMonthlyAiCreditsUsed()).isZero();
        assertThat(saved.getMonthlyAiCreditsMonth()).isEqualTo("2026-06");
    }

    @Test
    void handlePaymentCompleted_recruiter_unlimitedPackage_setsMinusOne() {
        Recruiter recruiter = Recruiter.builder()
                .userId("u2").quotaJobPost(5).quotaCvViews(3).build();
        when(recruiterRepository.findByUserIdAndDeletedFalse("u2"))
                .thenReturn(Optional.of(recruiter));

        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .userId("u2").userRole("RECRUITER")
                .packageId("pro").packageName("Pro")
                .packageJobLimit(-1).packageCvLimit(-1)
                .packageAiCredits(30).packageDurationDays(null)
                .orderId("ord2")
                .paidAt(LocalDateTime.of(2026, 6, 25, 10, 0))
                .build();

        consumer.handlePaymentCompleted(event);

        ArgumentCaptor<Recruiter> captor = ArgumentCaptor.forClass(Recruiter.class);
        verify(recruiterRepository).save(captor.capture());
        Recruiter saved = captor.getValue();

        assertThat(saved.getQuotaJobPost()).isEqualTo(-1);
        assertThat(saved.getQuotaCvViews()).isEqualTo(-1);
        assertThat(saved.getPackageExpiresAt()).isNull();
    }

    @Test
    void handlePaymentCompleted_candidate_setsActivationFields() {
        Candidate candidate = Candidate.builder()
                .userId("u3")
                .monthlyAiCreditsUsed(5)
                .monthlyAiCreditsMonth("2026-06")
                .build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u3"))
                .thenReturn(Optional.of(candidate));

        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .userId("u3").userRole("CANDIDATE")
                .packageId("plus").packageName("Plus")
                .packageJobLimit(0).packageCvLimit(0)
                .packageAiCredits(20).packageDurationDays(30)
                .orderId("ord3")
                .paidAt(LocalDateTime.of(2026, 6, 25, 10, 0))
                .build();

        consumer.handlePaymentCompleted(event);

        ArgumentCaptor<Candidate> captor = ArgumentCaptor.forClass(Candidate.class);
        verify(candidateRepository).save(captor.capture());
        Candidate saved = captor.getValue();

        assertThat(saved.getActivePackageId()).isEqualTo("plus");
        assertThat(saved.getPackageActivatedAt()).isEqualTo(LocalDateTime.of(2026, 6, 25, 10, 0));
        assertThat(saved.getPackageExpiresAt()).isEqualTo(LocalDateTime.of(2026, 7, 25, 10, 0));
        assertThat(saved.getMonthlyAiCreditsUsed()).isZero();
        assertThat(saved.getMonthlyAiCreditsMonth()).isEqualTo("2026-06");
    }

    @Test
    void handlePaymentCompleted_userNotFound_logsAndContinues() {
        when(recruiterRepository.findByUserIdAndDeletedFalse("missing"))
                .thenReturn(Optional.empty());

        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .userId("missing").userRole("RECRUITER")
                .packageId("plus").packageJobLimit(5).packageCvLimit(10)
                .paidAt(LocalDateTime.now()).orderId("ord4").build();

        consumer.handlePaymentCompleted(event);

        verify(recruiterRepository, never()).save(any());
    }

    @Test
    void handlePaymentCompleted_exception_propagatesForDlqRouting() {
        when(recruiterRepository.findByUserIdAndDeletedFalse(any()))
                .thenThrow(new RuntimeException("DB error"));

        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .userId("u5").userRole("RECRUITER")
                .packageId("plus").packageJobLimit(5).packageCvLimit(10)
                .paidAt(LocalDateTime.now()).orderId("ord5").build();

        // must throw so Spring AMQP routes to DLQ
        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class,
                () -> consumer.handlePaymentCompleted(event));
    }

    @Test
    void handlePaymentCompleted_feePackage_delegatesToRecruiterService() {
        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .userId("u7").userRole("RECRUITER")
                .packageId("fee").packageName("Platform Fee")
                .packageJobLimit(0).packageCvLimit(0)
                .paidAt(LocalDateTime.of(2026, 6, 27, 10, 0))
                .orderId("ord-fee-1").build();

        consumer.handlePaymentCompleted(event);

        verify(recruiterService).updatePlatformFeePayment("u7", LocalDateTime.of(2026, 6, 27, 10, 0));
        verify(recruiterRepository, never()).save(any());
    }

    @Test
    void handlePaymentCompleted_duplicateOrderId_skipsProcessing() {
        Recruiter recruiter = Recruiter.builder()
                .userId("u6").quotaJobPost(5).quotaCvViews(3)
                .lastPaymentOrderId("ord-already-processed").build();
        when(recruiterRepository.findByUserIdAndDeletedFalse("u6"))
                .thenReturn(Optional.of(recruiter));

        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .userId("u6").userRole("RECRUITER")
                .packageId("plus").packageJobLimit(10).packageCvLimit(20)
                .paidAt(LocalDateTime.now()).orderId("ord-already-processed").build();

        consumer.handlePaymentCompleted(event);

        verify(recruiterRepository, never()).save(any());
    }
}
