package vn.chuongpl.job_service.features.job;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import vn.chuongpl.job_service.dtos.response.JobResponse;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import vn.chuongpl.job_service.enums.JobModerationStatus;
import vn.chuongpl.job_service.enums.JobVisibilityStatus;
import vn.chuongpl.job_service.integration.elasticsearch.JobIndexService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JobBatchServiceTest {
    @Mock JobRepository jobRepository;
    @Mock JobIndexService jobIndexService;
    @Mock JobMapper jobMapper;
    @Mock RabbitTemplate rabbitTemplate;
    @Mock ObjectProvider<JobIndexService> jobIndexServiceProvider;
    @InjectMocks JobService jobService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(jobService, "defaultPageSize", 10);
    }

    @Test
    void getJobsByIds_shouldReturnMappedResponses() {
        Job job1 = Job.builder().id("j1")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.ACTIVE)
                .build();
        Job job2 = Job.builder().id("j2")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.ACTIVE)
                .build();
        JobResponse resp1 = new JobResponse(); resp1.setId("j1");
        JobResponse resp2 = new JobResponse(); resp2.setId("j2");
        when(jobRepository.findAllByIdInAndDeletedFalse(List.of("j1", "j2"))).thenReturn(List.of(job1, job2));
        when(jobMapper.toJobResponse(job1)).thenReturn(resp1);
        when(jobMapper.toJobResponse(job2)).thenReturn(resp2);

        List<JobResponse> result = jobService.getJobsByIds(List.of("j1", "j2"));

        assertEquals(2, result.size());
        assertEquals("j1", result.get(0).getId());
        assertEquals("j2", result.get(1).getId());
    }

    @Test
    void getJobsByIds_shouldReturnEmptyListForEmptyInput() {
        List<JobResponse> result = jobService.getJobsByIds(List.of());

        assertTrue(result.isEmpty());
        verifyNoInteractions(jobRepository);
    }

    @Test
    void getActiveJobsByRecruiter_shouldReturnOnlyActiveJobsForRecruiter() {
        Job job1 = Job.builder().id("j1").recruiterId("r1")
                .moderationStatus(JobModerationStatus.PUBLISHED)
                .visibilityStatus(JobVisibilityStatus.ACTIVE)
                .build();
        JobResponse resp1 = new JobResponse(); resp1.setId("j1");
        when(jobRepository.findTop20ByRecruiterIdAndModerationStatusAndVisibilityStatusAndDeletedFalse(
                "r1",
                JobModerationStatus.PUBLISHED,
                JobVisibilityStatus.ACTIVE
        ))
                .thenReturn(List.of(job1));
        when(jobMapper.toJobResponse(job1)).thenReturn(resp1);

        List<JobResponse> result = jobService.getActiveJobsByRecruiter("r1");

        assertEquals(1, result.size());
        assertEquals("j1", result.get(0).getId());
    }
}
