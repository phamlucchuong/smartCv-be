package vn.chuongpl.application_service.features.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.test.util.ReflectionTestUtils;
import vn.chuongpl.application_service.dtos.PageResponse;
import vn.chuongpl.application_service.dtos.request.ApplicationCreateRequest;
import vn.chuongpl.application_service.dtos.request.ApplicationStatusUpdateRequest;
import vn.chuongpl.application_service.dtos.response.ApplicationResponse;
import vn.chuongpl.application_service.enums.ApplicationStatus;
import vn.chuongpl.application_service.enums.ErrorCode;
import vn.chuongpl.application_service.exception.AppException;
import vn.chuongpl.application_service.integration.ai.AiScoringPublisher;
import vn.chuongpl.application_service.integration.job.JobClient;
import vn.chuongpl.application_service.integration.job.JobResponse;
import vn.chuongpl.application_service.integration.notification.NotificationPublisher;
import vn.chuongpl.application_service.integration.user.UserClient;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceTest {

    @Mock
    ApplicationRepository applicationRepository;
    @Mock
    ApplicationMapper applicationMapper;
    @Mock
    JobClient jobClient;
    @Mock
    UserClient userClient;
    @Mock
    NotificationPublisher notificationPublisher;
    @Mock
    AiScoringPublisher aiScoringPublisher;

    @InjectMocks
    ApplicationService applicationService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(applicationService, "defaultPageSize", 10);
    }

    @Test
    void submit_shouldPublishNewApplicationNotificationOnSuccess() {
        ApplicationCreateRequest request = new ApplicationCreateRequest("job-1", "cv.pdf", "cover");
        when(jobClient.getActiveJob("job-1"))
                .thenReturn(JobResponse.builder().id("job-1").recruiterId("recruiter-1").title("Backend Engineer").build());
        when(applicationRepository.existsByCandidateIdAndJobIdAndStatusIn(eq("candidate-1"), eq("job-1"), anyList()))
                .thenReturn(false);
        when(userClient.getCandidateEmail("candidate-1")).thenReturn("candidate@example.com");
        Application saved = Application.builder()
                .id("app-new")
                .candidateId("candidate-1")
                .jobId("job-1")
                .recruiterId("recruiter-1")
                .build();
        when(applicationRepository.save(any(Application.class))).thenReturn(saved);
        when(applicationMapper.toResponse(saved)).thenReturn(ApplicationResponse.builder().id("app-new").build());

        applicationService.submit(request, "candidate-1");

        verify(notificationPublisher).publishNewApplication(eq(saved), any());
    }

    @Test
    void submit_shouldThrowWhenCandidateAlreadyApplied() {
        ApplicationCreateRequest request = new ApplicationCreateRequest("job-1", "cv.pdf", "cover");
        when(jobClient.getActiveJob("job-1"))
                .thenReturn(JobResponse.builder().id("job-1").recruiterId("recruiter-1").title("Backend Engineer").build());
        when(applicationRepository.existsByCandidateIdAndJobIdAndStatusIn(eq("candidate-1"), eq("job-1"), anyList()))
                .thenReturn(true);

        AppException ex = assertThrows(
                AppException.class,
                () -> applicationService.submit(request, "candidate-1")
        );

        assertEquals(ErrorCode.APPLICATION_ALREADY_EXISTS, ex.getErrorCode());
        verify(applicationRepository, never()).save(any(Application.class));
        verify(aiScoringPublisher, never()).publishScoringRequest(any(Application.class));
    }

    @Test
    void getById_shouldRejectRecruiterWhoDoesNotOwnApplication() {
        Application application = Application.builder()
                .id("app-1")
                .candidateId("candidate-1")
                .recruiterId("recruiter-1")
                .build();
        when(applicationRepository.findByIdAndDeletedFalse("app-1")).thenReturn(Optional.of(application));

        AppException ex = assertThrows(
                AppException.class,
                () -> applicationService.getById("app-1", "recruiter-2", false, true)
        );

        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
    }

    @Test
    void updateStatus_shouldRequireRejectionReason() {
        Application application = Application.builder()
                .id("app-1")
                .recruiterId("recruiter-1")
                .status(ApplicationStatus.REVIEWING)
                .build();
        when(applicationRepository.findByIdAndDeletedFalse("app-1")).thenReturn(Optional.of(application));
        when(userClient.resolveRecruiterId("recruiter-1")).thenReturn("recruiter-1");

        AppException ex = assertThrows(
                AppException.class,
                () -> applicationService.updateStatus(
                        "app-1",
                        new ApplicationStatusUpdateRequest(ApplicationStatus.REJECTED, "  ", null),
                        "recruiter-1",
                        false
                )
        );

        assertEquals(ErrorCode.APPLICATION_INVALID_TRANSITION, ex.getErrorCode());
        verify(applicationMapper, never()).updateStatus(any(Application.class), any(ApplicationStatusUpdateRequest.class));
        verify(notificationPublisher, never()).publishStatusChanged(any(Application.class));
    }

    @Test
    void withdraw_shouldRejectTerminalStatus() {
        Application application = Application.builder()
                .id("app-1")
                .candidateId("candidate-1")
                .status(ApplicationStatus.ACCEPTED)
                .build();
        when(applicationRepository.findByIdAndDeletedFalse("app-1")).thenReturn(Optional.of(application));

        AppException ex = assertThrows(
                AppException.class,
                () -> applicationService.withdraw("app-1", "candidate-1")
        );

        assertEquals(ErrorCode.APPLICATION_STATUS_TERMINAL, ex.getErrorCode());
        verify(applicationRepository, never()).save(any(Application.class));
    }

    @Test
    void getMyApplications_shouldFallbackToDefaultPageSize() {
        Application application = Application.builder().id("app-1").candidateId("candidate-1").build();
        ApplicationResponse response = ApplicationResponse.builder().id("app-1").candidateId("candidate-1").build();
        PageRequest expectedPage = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "appliedAt"));

        when(applicationRepository.findByCandidateIdAndDeletedFalse(eq("candidate-1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(application), expectedPage, 1));
        when(applicationMapper.toResponse(application)).thenReturn(response);

        PageResponse<ApplicationResponse> actual = applicationService.getMyApplications("candidate-1", 0, 0);

        assertEquals(1, actual.getPage());
        assertEquals(10, actual.getPageSize());
        assertEquals(1, actual.getItems().size());
        verify(applicationRepository).findByCandidateIdAndDeletedFalse(eq("candidate-1"), eq(expectedPage));
    }
}
