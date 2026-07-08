package vn.chuongpl.ai_engine_service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.integration.job.JobClient;
import vn.chuongpl.ai_engine_service.integration.job.JobSummary;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobClientTest {

    @Mock
    RestTemplate restTemplate;

    JobClient jobClient;

    @BeforeEach
    void setUp() {
        jobClient = new JobClient(restTemplate, new com.fasterxml.jackson.databind.ObjectMapper());
        ReflectionTestUtils.setField(jobClient, "jobServiceBaseUrl", "http://localhost:8082");
        ReflectionTestUtils.setField(jobClient, "internalSecret", "test-secret");
    }

    @Test
    void getActiveJobs_callsPublishedJobsEndpoint() {
        Map<String, Object> job = Map.of(
                "id", "job-1",
                "title", "Backend Engineer",
                "company", "Acme",
                "description", "Build APIs",
                "skills", List.of("Java", "Spring Boot"),
                "requirements", List.of("3 years"),
                "experienceLevel", "Mid"
        );
        Map<String, Object> body = Map.of(
                "data", Map.of("content", List.of(job))
        );
        when(restTemplate.exchange(
                eq("http://localhost:8082/api/jobs?page=0&size=20"),
                eq(HttpMethod.GET),
                any(),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok(new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(body).toString()));

        List<JobSummary> jobs = jobClient.getActiveJobs(0, 20);

        assertThat(jobs).hasSize(1);
        assertThat(jobs.getFirst().id()).isEqualTo("job-1");
        verify(restTemplate).exchange(
                eq("http://localhost:8082/api/jobs?page=0&size=20"),
                eq(HttpMethod.GET),
                any(),
                eq(String.class)
        );
    }
}
