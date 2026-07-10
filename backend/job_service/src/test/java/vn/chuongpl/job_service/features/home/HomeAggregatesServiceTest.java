package vn.chuongpl.job_service.features.home;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import vn.chuongpl.job_service.dtos.response.JobResponse;
import vn.chuongpl.job_service.features.job.Job;
import vn.chuongpl.job_service.features.job.JobMapper;
import vn.chuongpl.job_service.features.home.ResourceItem;
import vn.chuongpl.job_service.features.home.TestimonialItem;
import vn.chuongpl.job_service.features.home.FaqItem;
import vn.chuongpl.job_service.integration.applicationservice.ApplicationServiceClient;
import vn.chuongpl.job_service.integration.userservice.UserServiceClient;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HomeAggregatesServiceTest {
    @Mock MongoTemplate mongoTemplate;
    @Mock JobMapper jobMapper;
    @Mock UserServiceClient userServiceClient;
    @Mock ApplicationServiceClient applicationServiceClient;
    @InjectMocks HomeService homeService;

    @Test
    void getTopCompanies_shouldReturnAggregatedResultsWithCompanyId() {
        java.util.List<Job> activeJobs = new java.util.ArrayList<>();
        for (int i = 0; i < 5; i++) {
            Job job = Job.builder().id("job" + i).recruiterId("r1")
                    .company("TechCorp").location("Hanoi").build();
            activeJobs.add(job);
        }

        when(mongoTemplate.find(any(Query.class), eq(Job.class))).thenReturn(activeJobs);
        when(applicationServiceClient.getTopJobs(1000)).thenReturn(List.of());
        when(userServiceClient.getCompanyData("r1"))
                .thenReturn(new UserServiceClient.CompanyData("company-uuid-1", "TechCorp", null, null, null, "Hanoi"));

        List<TopCompanyResponse> result = homeService.getTopCompanies();

        assertEquals(1, result.size());
        assertEquals("TechCorp", result.get(0).getName());
        assertEquals("r1", result.get(0).getRecruiterId());
        assertEquals("company-uuid-1", result.get(0).getCompanyId());
        assertEquals(5L, result.get(0).getActiveJobCount());
    }

    @Test
    void getHotJobs_shouldReturnJobsSortedByApplicationCount() {
        Job job = new Job();
        job.setId("job1");
        JobResponse jobResponse = new JobResponse();
        jobResponse.setId("job1");

        when(applicationServiceClient.getTopJobIds(6)).thenReturn(List.of("job1"));
        when(mongoTemplate.find(any(Query.class), eq(Job.class))).thenReturn(List.of(job));
        when(jobMapper.toJobResponse(job)).thenReturn(jobResponse);

        List<JobResponse> result = homeService.getHotJobs();

        assertEquals(1, result.size());
        assertEquals("job1", result.get(0).getId());
    }

    @Test
    void getHotJobs_shouldFallbackToFeaturedJobsWhenNoApplications() {
        Job job = new Job();
        job.setId("featured1");
        JobResponse jobResponse = new JobResponse();
        jobResponse.setId("featured1");

        when(applicationServiceClient.getTopJobIds(6)).thenReturn(List.of());
        when(mongoTemplate.find(any(Query.class), eq(Job.class))).thenReturn(List.of(job));
        when(jobMapper.toJobResponse(job)).thenReturn(jobResponse);

        List<JobResponse> result = homeService.getHotJobs();

        assertEquals(1, result.size());
        assertEquals("featured1", result.get(0).getId());
    }

    @Test
    void getResources_shouldReturnNonEmptyList() {
        List<ResourceItem> result = homeService.getResources();
        assertFalse(result.isEmpty());
        assertNotNull(result.get(0).getTitle());
        assertNotNull(result.get(0).getUrl());
    }

    @Test
    void getTestimonials_shouldReturnNonEmptyList() {
        List<TestimonialItem> result = homeService.getTestimonials();
        assertFalse(result.isEmpty());
        assertNotNull(result.get(0).getName());
        assertNotNull(result.get(0).getQuote());
    }

    @Test
    void getFaqs_shouldReturnNonEmptyList() {
        List<FaqItem> result = homeService.getFaqs();
        assertFalse(result.isEmpty());
        assertNotNull(result.get(0).getQuestion());
        assertNotNull(result.get(0).getAnswer());
    }
}
