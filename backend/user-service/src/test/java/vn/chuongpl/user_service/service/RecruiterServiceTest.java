package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;
import vn.chuongpl.user_service.dtos.message.RecruiterPendingEventMessage;
import vn.chuongpl.user_service.dtos.message.RecruiterStatusEventMessage;
import vn.chuongpl.user_service.dtos.request.RecruiterRequest;
import vn.chuongpl.user_service.dtos.request.RecruiterStatusRequest;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.enums.RecruiterStatus;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.recruiter.Recruiter;
import vn.chuongpl.user_service.features.recruiter.RecruiterMapper;
import vn.chuongpl.user_service.features.recruiter.RecruiterRepository;
import vn.chuongpl.user_service.features.recruiter.RecruiterService;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecruiterServiceTest {

    @Mock RecruiterRepository recruiterRepository;
    @Mock UserRepository userRepository;
    @Mock RecruiterMapper recruiterMapper;
    @Mock RabbitTemplate rabbitTemplate;
    @Mock ServicePackageRepository servicePackageRepository;
    @Mock vn.chuongpl.user_service.integration.notification.AiCreditExhaustedPublisher aiCreditExhaustedPublisher;

    @InjectMocks
    RecruiterService recruiterService;

    // ── createBasicProfile ──────────────────────────────────────────────────

    @Test
    void createBasicProfile_shouldCreateWithDraftStatus() {
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.empty());

        recruiterService.createBasicProfile("u1", "ACME");

        ArgumentCaptor<Recruiter> captor = ArgumentCaptor.forClass(Recruiter.class);
        verify(recruiterRepository).save(captor.capture());
        assertEquals(RecruiterStatus.DRAFT, captor.getValue().getStatus());
    }

    @Test
    void createBasicProfile_shouldPersistCompanyNameWhenProvided() {
        when(recruiterRepository.findByUserIdAndDeletedFalse("u2")).thenReturn(Optional.empty());

        recruiterService.createBasicProfile("u2", "ACME");

        ArgumentCaptor<Recruiter> captor = ArgumentCaptor.forClass(Recruiter.class);
        verify(recruiterRepository).save(captor.capture());
        Recruiter saved = captor.getValue();
        assertEquals("u2", saved.getUserId());
        assertEquals("ACME", saved.getCompanyName());
        assertFalse(saved.isDeleted());
        assertNotNull(saved.getCreatedAt());
        assertNotNull(saved.getUpdatedAt());
    }

    @Test
    void createBasicProfile_shouldUpdateExistingCompanyNameWhenProvided() {
        Recruiter existing = Recruiter.builder().id("r1").userId("u2").companyName("Old Corp").build();
        when(recruiterRepository.findByUserIdAndDeletedFalse("u2")).thenReturn(Optional.of(existing));

        recruiterService.createBasicProfile("u2", "New Corp");

        assertEquals("New Corp", existing.getCompanyName());
        assertNotNull(existing.getUpdatedAt());
        verify(recruiterRepository).save(existing);
    }

    // ── submitForApproval ───────────────────────────────────────────────────

    @Test
    void submitForApproval_shouldTransitionDraftToPending() {
        Recruiter recruiter = fullRecruiter("r1", "u1", RecruiterStatus.DRAFT);
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(recruiter));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        User user = User.builder().id("u1").build();
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());
        when(userRepository.findByRoles_NameIn(any(), any())).thenReturn(new PageImpl<>(List.of()));

        recruiterService.submitForApproval("u1");

        assertEquals(RecruiterStatus.PENDING, recruiter.getStatus());
        assertNull(recruiter.getRejectionNote());
        verify(recruiterRepository).save(recruiter);
    }

    @Test
    void submitForApproval_shouldTransitionRejectedToPending() {
        Recruiter recruiter = fullRecruiter("r1", "u1", RecruiterStatus.REJECTED);
        recruiter.setRejectionNote("Missing tax code");
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(recruiter));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        User user = User.builder().id("u1").build();
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());
        when(userRepository.findByRoles_NameIn(any(), any())).thenReturn(new PageImpl<>(List.of()));

        recruiterService.submitForApproval("u1");

        assertEquals(RecruiterStatus.PENDING, recruiter.getStatus());
        assertNull(recruiter.getRejectionNote());
    }

    @Test
    void submitForApproval_shouldThrowWhenStatusIsAlreadyPending() {
        Recruiter recruiter = fullRecruiter("r1", "u1", RecruiterStatus.PENDING);
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(recruiter));

        AppException ex = assertThrows(AppException.class, () -> recruiterService.submitForApproval("u1"));
        assertEquals(ErrorCode.RECRUITER_INVALID_STATUS_TRANSITION, ex.getErrorCode());
    }

    @Test
    void submitForApproval_shouldThrowWhenStatusIsApproved() {
        Recruiter recruiter = fullRecruiter("r1", "u1", RecruiterStatus.APPROVED);
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(recruiter));

        AppException ex = assertThrows(AppException.class, () -> recruiterService.submitForApproval("u1"));
        assertEquals(ErrorCode.RECRUITER_INVALID_STATUS_TRANSITION, ex.getErrorCode());
    }

    @Test
    void submitForApproval_shouldThrowWhenRequiredFieldMissing() {
        Recruiter recruiter = Recruiter.builder()
                .id("r1").userId("u1")
                .status(RecruiterStatus.DRAFT)
                // companyName intentionally missing
                .taxCode("TAX123")
                .companyAddress("HN")
                .companyCity("HN")
                .industry("IT")
                .companyType("STARTUP")
                .companySize("11-50")
                .businessLicenseUrl("https://s3.example.com/license.pdf")
                .build();
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(recruiter));

        AppException ex = assertThrows(AppException.class, () -> recruiterService.submitForApproval("u1"));
        assertEquals(ErrorCode.RECRUITER_PROFILE_INCOMPLETE, ex.getErrorCode());
    }

    @Test
    void submitForApproval_shouldPublishPendingEventWithAdminIds() {
        Recruiter recruiter = fullRecruiter("r1", "u1", RecruiterStatus.DRAFT);
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(recruiter));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        User user = User.builder().id("u1").email("recruiter@acme.com").build();
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());

        User admin1 = User.builder().id("admin1").build();
        User admin2 = User.builder().id("admin2").build();
        when(userRepository.findByRoles_NameIn(eq(List.of("ADMIN")), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(admin1, admin2)));

        recruiterService.submitForApproval("u1");

        ArgumentCaptor<RecruiterPendingEventMessage> captor = ArgumentCaptor.forClass(RecruiterPendingEventMessage.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.RECRUITER_EXCHANGE),
                eq(RabbitMQConfig.RECRUITER_PENDING_KEY),
                captor.capture());
        RecruiterPendingEventMessage event = captor.getValue();
        assertEquals("r1", event.getRecruiterId());
        assertEquals("recruiter@acme.com", event.getRecruiterEmail());
        assertEquals("ACME Corp", event.getCompanyName());
        assertTrue(event.getAdminUserIds().contains("admin1"));
        assertTrue(event.getAdminUserIds().contains("admin2"));
        assertNotNull(event.getOccurredAt());
    }

    @Test
    void submitForApproval_shouldNotPublishEventWhenNoAdminsExist() {
        Recruiter recruiter = fullRecruiter("r1", "u1", RecruiterStatus.DRAFT);
        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(recruiter));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        User user = User.builder().id("u1").email("recruiter@acme.com").build();
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());
        when(userRepository.findByRoles_NameIn(any(), any())).thenReturn(new PageImpl<>(List.of()));

        recruiterService.submitForApproval("u1");

        verify(rabbitTemplate, never()).convertAndSend(
                anyString(), anyString(), any(RecruiterPendingEventMessage.class));
    }

    // ── updateStatus ─────────────────────────────────────────────────────────

    @Test
    void updateStatus_shouldPublishApprovedEventToRabbit() {
        Recruiter recruiter = Recruiter.builder()
                .id("r1").userId("u1").status(RecruiterStatus.PENDING)
                .companyName("ACME Corp").contactEmail("contact@acme.com").build();
        User user = User.builder().id("u1").email("admin@acme.com").build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(recruiter));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());

        recruiterService.updateStatus("r1", RecruiterStatusRequest.builder().status(RecruiterStatus.APPROVED).build());

        ArgumentCaptor<RecruiterStatusEventMessage> captor = ArgumentCaptor.forClass(RecruiterStatusEventMessage.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.RECRUITER_EXCHANGE),
                eq(RabbitMQConfig.RECRUITER_APPROVED_KEY),
                captor.capture());
        RecruiterStatusEventMessage event = captor.getValue();
        assertEquals("r1", event.getRecruiterId());
        assertEquals("admin@acme.com", event.getRecruiterEmail());
        assertEquals("ACME Corp", event.getCompanyName());
        assertEquals(RecruiterStatus.APPROVED, event.getStatus());
        assertNull(event.getRejectionNote());
    }

    @Test
    void updateStatus_shouldPublishRejectedEventWithNoteToRabbit() {
        Recruiter recruiter = Recruiter.builder()
                .id("r2").userId("u2").status(RecruiterStatus.PENDING).companyName("Beta Ltd").build();
        User user = User.builder().id("u2").email("owner@beta.com").build();
        when(recruiterRepository.findById("r2")).thenReturn(Optional.of(recruiter));
        when(userRepository.findById("u2")).thenReturn(Optional.of(user));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());

        recruiterService.updateStatus("r2", RecruiterStatusRequest.builder()
                .status(RecruiterStatus.REJECTED).rejectionNote("Missing license").build());

        ArgumentCaptor<RecruiterStatusEventMessage> captor = ArgumentCaptor.forClass(RecruiterStatusEventMessage.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.RECRUITER_EXCHANGE),
                eq(RabbitMQConfig.RECRUITER_REJECTED_KEY),
                captor.capture());
        RecruiterStatusEventMessage event = captor.getValue();
        assertEquals("r2", event.getRecruiterId());
        assertEquals(RecruiterStatus.REJECTED, event.getStatus());
        assertEquals("Missing license", event.getRejectionNote());
    }

    @Test
    void updateStatus_shouldStoreRejectionNoteWhenRejected() {
        Recruiter recruiter = Recruiter.builder().id("r1").userId("u1").status(RecruiterStatus.PENDING).build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(recruiter));
        when(userRepository.findById("u1")).thenReturn(Optional.of(User.builder().id("u1").build()));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());

        RecruiterStatusRequest req = RecruiterStatusRequest.builder()
                .status(RecruiterStatus.REJECTED)
                .rejectionNote("Missing business license")
                .build();
        recruiterService.updateStatus("r1", req);

        assertEquals(RecruiterStatus.REJECTED, recruiter.getStatus());
        assertEquals("Missing business license", recruiter.getRejectionNote());
    }

    @Test
    void updateStatus_shouldClearRejectionNoteWhenApproved() {
        Recruiter recruiter = Recruiter.builder()
                .id("r1").userId("u1")
                .status(RecruiterStatus.REJECTED)
                .rejectionNote("Old note")
                .build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(recruiter));
        when(userRepository.findById("u1")).thenReturn(Optional.of(User.builder().id("u1").build()));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());

        RecruiterStatusRequest req = RecruiterStatusRequest.builder()
                .status(RecruiterStatus.APPROVED)
                .build();
        recruiterService.updateStatus("r1", req);

        assertEquals(RecruiterStatus.APPROVED, recruiter.getStatus());
        assertNull(recruiter.getRejectionNote());
    }

    // ── update (profile edit lock) ────────────────────────────────────────────

    @Test
    void update_shouldThrowWhenNonAdminEditsWhilePending() {
        Recruiter recruiter = Recruiter.builder()
                .id("r1").userId("u1")
                .status(RecruiterStatus.PENDING)
                .build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(recruiter));

        AppException ex = assertThrows(AppException.class,
                () -> recruiterService.update("r1", new RecruiterRequest(), "u1", false));
        assertEquals(ErrorCode.RECRUITER_PROFILE_LOCKED, ex.getErrorCode());
    }

    @Test
    void update_shouldAllowAdminEditWhilePending() {
        Recruiter recruiter = Recruiter.builder()
                .id("r1").userId("u1")
                .status(RecruiterStatus.PENDING)
                .build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(recruiter));
        when(userRepository.findById("u1")).thenReturn(Optional.of(User.builder().id("u1").build()));
        when(recruiterRepository.save(any())).thenReturn(recruiter);
        when(recruiterMapper.toRecruiterResponse(any(), any())).thenReturn(new vn.chuongpl.user_service.dtos.response.RecruiterResponse());

        assertDoesNotThrow(() -> recruiterService.update("r1", new RecruiterRequest(), "admin", true));
    }

    @Test
    void getProfile_shouldExposeAiCreditSummaryForBilling() {
        Recruiter recruiter = Recruiter.builder()
                .id("r1")
                .userId("u1")
                .activePackageId("pro")
                .monthlyAiCreditsUsed(12)
                .monthlyAiCreditsMonth(java.time.YearMonth.now().toString())
                .build();
        ServicePackage activePackage = ServicePackage.builder().id("pro").aiCredits(30).build();

        when(recruiterRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(recruiter));
        when(servicePackageRepository.findById("pro")).thenReturn(Optional.of(activePackage));

        var response = recruiterService.getProfile("u1");

        assertEquals(30, response.getAiCreditsTotal());
        assertEquals(12, response.getAiCreditsUsed());
        assertEquals(18, response.getAiCreditsRemaining());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Recruiter fullRecruiter(String id, String userId, RecruiterStatus status) {
        return Recruiter.builder()
                .id(id).userId(userId).status(status)
                .companyName("ACME Corp")
                .taxCode("TAX123")
                .companyAddress("123 Main St")
                .companyCity("Ho Chi Minh City")
                .industry("Technology")
                .companyType("STARTUP")
                .companySize("11-50")
                .businessLicenseUrl("https://s3.example.com/license.pdf")
                .build();
    }
}
