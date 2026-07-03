package vn.chuongpl.job_service.features.job;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.util.ReflectionTestUtils;
import vn.chuongpl.job_service.config.RabbitMQConfig;
import vn.chuongpl.job_service.dtos.PageResponse;
import vn.chuongpl.job_service.dtos.request.JobCreateRequest;
import vn.chuongpl.job_service.dtos.request.JobRejectRequest;
import vn.chuongpl.job_service.dtos.request.JobUpdateRequest;
import vn.chuongpl.job_service.dtos.response.JobResponse;
import vn.chuongpl.job_service.enums.ErrorCode;
import vn.chuongpl.job_service.enums.JobModerationStatus;
import vn.chuongpl.job_service.enums.JobVisibilityStatus;
import vn.chuongpl.job_service.exception.AppException;
import vn.chuongpl.job_service.integration.elasticsearch.JobIndexService;
import vn.chuongpl.job_service.integration.userservice.UserServiceClient;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

@ExtendWith(MockitoExtension.class)
class JobServiceTest {

    @Mock JobRepository jobRepository;
    @Mock MongoTemplate mongoTemplate;
    @Mock JobIndexService jobIndexService;
    @Mock JobMapper jobMapper;
    @Mock RabbitTemplate rabbitTemplate;
    @Mock ObjectProvider<JobIndexService> jobIndexServiceProvider;
    @Mock UserServiceClient userServiceClient;

    @InjectMocks
    JobService jobService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(jobService, "defaultPageSize", 10);
    }

    @Test
    void getJobById_shouldHideNonPublicJobs() {
        Job job = Job.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.PENDING)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();
        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));

        AppException ex = assertThrows(AppException.class, () -> jobService.getJobById("job-1"));

        assertEquals(ErrorCode.JOB_NOT_FOUND, ex.getErrorCode());
        verify(jobMapper, never()).toJobResponse(any(Job.class));
    }

    @Test
    void createJob_shouldApplyDraftDefaults_whenFieldsAreNull() {
        JobCreateRequest request = new JobCreateRequest();
        Job mappedJob = Job.builder()
                .qualifiedThreshold(null)
                .rejectThreshold(null)
                .autoRejectEnabled(null)
                .requiredTest(null)
                .title("  Backend Engineer  ")
                .build();
        Job savedJob = Job.builder().id("job-1").build();
        JobResponse expected = JobResponse.builder().id("job-1").build();

        when(userServiceClient.getRecruiterProfile("recruiter-1"))
                .thenReturn(new UserServiceClient.RecruiterProfileDto("recruiter-1", "APPROVED"));
        when(jobMapper.toJob(request)).thenReturn(mappedJob);
        when(jobRepository.existsByRecruiterIdAndNormalizedTitleAndDeletedFalse("recruiter-1", "backend engineer"))
                .thenReturn(false);
        when(jobRepository.save(mappedJob)).thenReturn(savedJob);
        when(jobMapper.toJobResponse(savedJob)).thenReturn(expected);

        jobService.createJob(request, "recruiter-1");

        assertEquals("recruiter-1", mappedJob.getRecruiterId());
        assertEquals("Backend Engineer", mappedJob.getTitle());
        assertEquals("backend engineer", mappedJob.getNormalizedTitle());
        assertEquals(JobModerationStatus.DRAFT, mappedJob.getModerationStatus());
        assertEquals(JobVisibilityStatus.INACTIVE, mappedJob.getVisibilityStatus());
        assertEquals(70, mappedJob.getQualifiedThreshold());
        assertEquals(50, mappedJob.getRejectThreshold());
        assertEquals(false, mappedJob.getAutoRejectEnabled());
    }

    @Test
    void createJob_shouldRejectDuplicateTitleWithinRecruiter() {
        JobCreateRequest request = new JobCreateRequest();
        Job mappedJob = Job.builder().title(" Backend Engineer ").build();

        when(userServiceClient.getRecruiterProfile("recruiter-1"))
                .thenReturn(new UserServiceClient.RecruiterProfileDto("recruiter-1", "APPROVED"));
        when(jobMapper.toJob(request)).thenReturn(mappedJob);
        when(jobRepository.existsByRecruiterIdAndNormalizedTitleAndDeletedFalse("recruiter-1", "backend engineer"))
                .thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> jobService.createJob(request, "recruiter-1"));

        assertEquals(ErrorCode.JOB_TITLE_ALREADY_EXISTS, ex.getErrorCode());
        verify(jobRepository, never()).save(any(Job.class));
    }

    @Test
    void createJob_shouldThrowWhenRecruiterNotApproved() {
        JobCreateRequest request = new JobCreateRequest();

        when(userServiceClient.getRecruiterProfile("recruiter-pending"))
                .thenReturn(new UserServiceClient.RecruiterProfileDto(null, "PENDING"));

        AppException ex = assertThrows(AppException.class, () -> jobService.createJob(request, "recruiter-pending"));

        assertEquals(ErrorCode.RECRUITER_NOT_APPROVED, ex.getErrorCode());
        verify(jobMapper, never()).toJob(any());
        verify(jobRepository, never()).save(any());
    }

    @Test
    void submitJob_shouldMoveDraftToPending() {
        Job job = Job.builder()
                .id("job-1")
                .recruiterId("recruiter-1")
                .title("Backend Engineer")
                .normalizedTitle("backend engineer")
                .company("SmartCV")
                .description("Build APIs")
                .location("HCMC")
                .jobType(vn.chuongpl.job_service.enums.JobType.FULL_TIME)
                .experienceLevel(vn.chuongpl.job_service.enums.ExperienceLevel.MIDDLE)
                .deadline(LocalDate.now().plusDays(7))
                .moderationStatus(JobModerationStatus.DRAFT)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();
        JobResponse response = JobResponse.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.PENDING)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();

        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(userServiceClient.resolveRecruiterId("recruiter-1")).thenReturn("recruiter-1");
        when(jobRepository.existsByRecruiterIdAndNormalizedTitleAndDeletedFalseAndIdNot("recruiter-1", "backend engineer", "job-1"))
                .thenReturn(false);
        when(jobRepository.save(job)).thenReturn(job);
        when(jobMapper.toJobResponse(job)).thenReturn(response);

        JobResponse actual = jobService.submitJob("job-1", "recruiter-1", false);

        assertEquals(JobModerationStatus.PENDING, job.getModerationStatus());
        assertEquals(JobVisibilityStatus.INACTIVE, job.getVisibilityStatus());
        assertEquals(JobModerationStatus.PENDING, actual.getModerationStatus());
    }

    @Test
    void approveJob_shouldMovePendingToPublishedAndActive() {
        Job job = Job.builder()
                .id("job-1")
                .recruiterId("recruiter-1")
                .title("Backend Engineer")
                .company("SmartCV")
                .description("Build APIs")
                .location("HCMC")
                .jobType(vn.chuongpl.job_service.enums.JobType.FULL_TIME)
                .experienceLevel(vn.chuongpl.job_service.enums.ExperienceLevel.MIDDLE)
                .deadline(LocalDate.now().plusDays(7))
                .moderationStatus(JobModerationStatus.PENDING)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();
        JobResponse response = JobResponse.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.ACTIVE)
                .build();

        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(jobRepository.save(job)).thenReturn(job);
        when(jobMapper.toJobResponse(job)).thenReturn(response);
        when(jobIndexServiceProvider.getIfAvailable()).thenReturn(jobIndexService);

        JobResponse actual = jobService.approveJob("job-1", "admin-1");

        assertEquals(JobModerationStatus.PUBLISHED, job.getModerationStatus());
        assertEquals(JobVisibilityStatus.ACTIVE, job.getVisibilityStatus());
        assertEquals(JobVisibilityStatus.ACTIVE, actual.getVisibilityStatus());
        verify(jobIndexService).indexJob(job);
        verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.EXCHANGE), eq(RabbitMQConfig.JOB_CREATED_ROUTING_KEY), any(JobEventMessage.class));
    }

    @Test
    void approveJob_shouldPublishModerationApprovedEvent() {
        Job job = Job.builder()
                .id("job-1").recruiterId("recruiter-1").title("Backend Engineer").company("SmartCV")
                .description("desc").location("HCMC")
                .jobType(vn.chuongpl.job_service.enums.JobType.FULL_TIME)
                .experienceLevel(vn.chuongpl.job_service.enums.ExperienceLevel.MIDDLE)
                .deadline(LocalDate.now().plusDays(7))
                .moderationStatus(JobModerationStatus.PENDING).visibilityStatus(JobVisibilityStatus.INACTIVE).build();

        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(jobRepository.save(job)).thenReturn(job);
        when(jobMapper.toJobResponse(job)).thenReturn(JobResponse.builder().id("job-1").build());
        when(jobIndexServiceProvider.getIfAvailable()).thenReturn(jobIndexService);
        when(userServiceClient.getRecruiterEmail("recruiter-1")).thenReturn("recruiter@acme.com");

        jobService.approveJob("job-1", "admin-1");

        ArgumentCaptor<JobEventMessage> captor = ArgumentCaptor.forClass(JobEventMessage.class);
        verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.EXCHANGE), eq(RabbitMQConfig.JOB_APPROVED_KEY), captor.capture());
        JobEventMessage event = captor.getValue();
        assertEquals("job-1", event.getJobId());
        assertEquals("recruiter-1", event.getRecruiterId());
        assertEquals("recruiter@acme.com", event.getRecruiterEmail());
        assertEquals("APPROVED", event.getEventType());
        assertNotNull(event.getOccurredAt());
    }

    @Test
    void rejectJob_shouldPublishModerationRejectedEventWithNote() {
        Job job = Job.builder()
                .id("job-1").recruiterId("recruiter-1").title("Backend Engineer").company("SmartCV")
                .moderationStatus(JobModerationStatus.PENDING).visibilityStatus(JobVisibilityStatus.INACTIVE).build();
        JobRejectRequest request = new JobRejectRequest("Thiếu mô tả chi tiết");

        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(jobRepository.save(job)).thenReturn(job);
        when(jobMapper.toJobResponse(job)).thenReturn(JobResponse.builder().id("job-1").build());
        when(userServiceClient.getRecruiterEmail("recruiter-1")).thenReturn("recruiter@acme.com");

        jobService.rejectJob("job-1", request, "admin-1");

        ArgumentCaptor<JobEventMessage> captor = ArgumentCaptor.forClass(JobEventMessage.class);
        verify(rabbitTemplate).convertAndSend(eq(RabbitMQConfig.EXCHANGE), eq(RabbitMQConfig.JOB_REJECTED_KEY), captor.capture());
        JobEventMessage event = captor.getValue();
        assertEquals("job-1", event.getJobId());
        assertEquals("recruiter@acme.com", event.getRecruiterEmail());
        assertEquals("REJECTED", event.getEventType());
        assertEquals("Thiếu mô tả chi tiết", event.getModerationNote());
    }

    @Test
    void rejectJob_shouldMovePendingBackToDraftWithModerationNote() {
        Job job = Job.builder()
                .id("job-1")
                .recruiterId("recruiter-1")
                .moderationStatus(JobModerationStatus.PENDING)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();
        JobRejectRequest request = new JobRejectRequest("Thiếu mô tả chi tiết");
        JobResponse response = JobResponse.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.DRAFT)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .moderationNote("Thiếu mô tả chi tiết")
                .build();

        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(jobRepository.save(job)).thenReturn(job);
        when(jobMapper.toJobResponse(job)).thenReturn(response);

        JobResponse actual = jobService.rejectJob("job-1", request, "admin-1");

        assertEquals(JobModerationStatus.DRAFT, job.getModerationStatus());
        assertEquals("Thiếu mô tả chi tiết", job.getModerationNote());
        assertEquals(JobModerationStatus.DRAFT, actual.getModerationStatus());
    }

    @Test
    void updateJob_shouldMovePublishedJobBackToPendingAndInactive() {
        Job job = Job.builder()
                .id("job-1")
                .recruiterId("recruiter-1")
                .title("Backend Engineer")
                .normalizedTitle("backend engineer")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.ACTIVE)
                .build();
        JobUpdateRequest request = new JobUpdateRequest();
        request.setTitle("Senior Backend Engineer");
        JobResponse response = JobResponse.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.PENDING)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();

        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(userServiceClient.resolveRecruiterId("recruiter-1")).thenReturn("recruiter-1");
        doAnswer(invocation -> {
            Job target = invocation.getArgument(0);
            JobUpdateRequest update = invocation.getArgument(1);
            target.setTitle(update.getTitle());
            return null;
        }).when(jobMapper).updateJob(any(Job.class), any(JobUpdateRequest.class));
        when(jobRepository.existsByRecruiterIdAndNormalizedTitleAndDeletedFalseAndIdNot("recruiter-1", "senior backend engineer", "job-1"))
                .thenReturn(false);
        when(jobRepository.save(job)).thenReturn(job);
        when(jobMapper.toJobResponse(job)).thenReturn(response);

        JobResponse actual = jobService.updateJob("job-1", request, "recruiter-1", false);

        assertEquals("Senior Backend Engineer", job.getTitle());
        assertEquals("senior backend engineer", job.getNormalizedTitle());
        assertEquals(JobModerationStatus.PENDING, job.getModerationStatus());
        assertEquals(JobVisibilityStatus.INACTIVE, job.getVisibilityStatus());
        assertEquals(JobModerationStatus.PENDING, actual.getModerationStatus());
    }

    @Test
    void deactivateJob_shouldRemovePublishedJobFromIndex() {
        Job job = Job.builder()
                .id("job-1")
                .recruiterId("recruiter-1")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.ACTIVE)
                .build();
        JobResponse response = JobResponse.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();

        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(userServiceClient.resolveRecruiterId("recruiter-1")).thenReturn("recruiter-1");
        when(jobRepository.save(job)).thenReturn(job);
        when(jobMapper.toJobResponse(job)).thenReturn(response);
        when(jobIndexServiceProvider.getIfAvailable()).thenReturn(jobIndexService);

        JobResponse actual = jobService.deactivateJob("job-1", "recruiter-1", false);

        assertEquals(JobVisibilityStatus.INACTIVE, job.getVisibilityStatus());
        assertEquals(JobVisibilityStatus.INACTIVE, actual.getVisibilityStatus());
        verify(jobIndexService).removeFromIndex("job-1");
    }

    @Test
    void deleteJob_shouldSoftDeleteAndRemoveIndex() {
        Job job = Job.builder().id("job-1").recruiterId("recruiter-1").deleted(false).build();
        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(userServiceClient.resolveRecruiterId("recruiter-1")).thenReturn("recruiter-1");
        when(jobIndexServiceProvider.getIfAvailable()).thenReturn(jobIndexService);

        jobService.deleteJob("job-1", "recruiter-1", false);

        assertTrue(job.isDeleted());
        verify(jobRepository).save(job);
        verify(jobIndexService).removeFromIndex("job-1");
    }

    @Test
    void getMyJobById_shouldReturnDraftJobForOwner() {
        Job job = Job.builder()
                .id("job-1")
                .recruiterId("recruiter-1")
                .moderationStatus(JobModerationStatus.DRAFT)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();
        JobResponse expected = JobResponse.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.DRAFT)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();
        when(jobRepository.findByIdAndDeletedFalse("job-1")).thenReturn(Optional.of(job));
        when(userServiceClient.resolveRecruiterId("recruiter-1")).thenReturn("recruiter-1");
        when(jobMapper.toJobResponse(job)).thenReturn(expected);

        JobResponse actual = jobService.getMyJobById("job-1", "recruiter-1", false);

        assertEquals(JobModerationStatus.DRAFT, actual.getModerationStatus());
    }

    @Test
    void getAllJobs_shouldFilterByModerationStatus_whenProvided() {
        Job pendingJob = Job.builder()
                .id("job-pending")
                .moderationStatus(JobModerationStatus.PENDING)
                .visibilityStatus(JobVisibilityStatus.INACTIVE)
                .build();
        JobResponse response = JobResponse.builder()
                .id("job-pending")
                .moderationStatus(JobModerationStatus.PENDING)
                .build();

        when(mongoTemplate.find(any(Query.class), eq(Job.class))).thenReturn(List.of(pendingJob));
        when(mongoTemplate.count(any(Query.class), eq(Job.class))).thenReturn(1L);
        when(jobMapper.toJobResponse(pendingJob)).thenReturn(response);

        PageResponse<JobResponse> actual = jobService.getAllJobs("PENDING", null, null, 1, 10);

        assertEquals(1, actual.getItems().size());
        assertEquals("job-pending", actual.getItems().get(0).getId());
        verify(mongoTemplate).find(any(Query.class), eq(Job.class));
        verify(jobRepository, never()).findByDeletedFalse(any(Pageable.class));
    }

    @Test
    void getAllJobs_shouldThrowAppException_whenModerationStatusIsInvalid() {
        AppException ex = assertThrows(AppException.class,
                () -> jobService.getAllJobs("INVALID_STATUS", null, null, 1, 10));
        assertEquals(ErrorCode.JOB_STATUS_INVALID, ex.getErrorCode());
        verify(jobRepository, never()).findByDeletedFalse(any());
        verify(jobRepository, never()).findByModerationStatusAndDeletedFalse(any(), any());
    }

    @Test
    void getAllJobs_shouldReturnAllJobs_whenModerationStatusIsNull() {
        Job job = Job.builder().id("job-1").build();
        JobResponse response = JobResponse.builder().id("job-1").build();
        PageRequest expectedPage = PageRequest.of(0, 10, Sort.by("createdAt").descending());

        when(jobRepository.findByDeletedFalse(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(job), expectedPage, 1));
        when(jobMapper.toJobResponse(job)).thenReturn(response);

        PageResponse<JobResponse> actual = jobService.getAllJobs(null, null, null, 1, 10);

        assertEquals(1, actual.getItems().size());
        verify(jobRepository).findByDeletedFalse(any(Pageable.class));
        verify(jobRepository, never()).findByModerationStatusAndDeletedFalse(any(), any());
    }

    @Test
    void getActiveJobs_shouldFallbackToDefaultPageSize() {
        Job job = Job.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.ACTIVE)
                .build();
        JobResponse response = JobResponse.builder()
                .id("job-1")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.ACTIVE)
                .build();
        PageRequest expectedPage = PageRequest.of(0, 10, Sort.by("createdAt").descending());

        when(jobRepository.findByModerationStatusAndVisibilityStatusAndDeletedFalse(
                eq(JobModerationStatus.PUBLISHED),
                eq(JobVisibilityStatus.ACTIVE),
                any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(job), expectedPage, 1));
        when(jobMapper.toJobResponse(job)).thenReturn(response);

        PageResponse<JobResponse> actual = jobService.getActiveJobs(0, 0);

        assertEquals(1, actual.getPage());
        assertEquals(10, actual.getPageSize());
        assertEquals(1, actual.getItems().size());
        verify(jobRepository).findByModerationStatusAndVisibilityStatusAndDeletedFalse(
                eq(JobModerationStatus.PUBLISHED),
                eq(JobVisibilityStatus.ACTIVE),
                eq(expectedPage)
        );
    }
}
