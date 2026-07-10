package vn.chuongpl.user_service.integration.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class JobClient {
    private final RestTemplate restTemplate;

    @Value("${integration.job-service-url}")
    private String jobServiceUrl;

    @Value("${app.gateway.internal-secret}")
    private String internalSecret;

    private HttpEntity<Void> internalRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Gateway-Secret", internalSecret);
        return new HttpEntity<>(headers);
    }

    public JobSummary getJobById(String jobId) {
        try {
            var response = restTemplate.exchange(
                    jobServiceUrl + "/api/jobs/" + jobId,
                    HttpMethod.GET,
                    internalRequest(),
                    new ParameterizedTypeReference<JobApiResponse<JobSummary>>() {}
            );
            if (response.getBody() != null) {
                return response.getBody().getData();
            }
        } catch (Exception e) {
            log.warn("Failed to fetch job {}: {}", jobId, e.getMessage());
        }
        return null;
    }

    public List<JobSummary> getJobsByRecruiter(String recruiterId) {
        try {
            var response = restTemplate.exchange(
                    jobServiceUrl + "/api/jobs/by-recruiter/" + recruiterId,
                    HttpMethod.GET,
                    internalRequest(),
                    new ParameterizedTypeReference<JobApiResponse<List<JobSummary>>>() {}
            );
            if (response.getBody() != null && response.getBody().getData() != null) {
                return response.getBody().getData();
            }
        } catch (Exception e) {
            log.warn("Failed to fetch jobs for recruiter {}: {}", recruiterId, e.getMessage());
        }
        return List.of();
    }

    public List<JobSummary> getJobsByIds(List<String> jobIds) {
        if (jobIds == null || jobIds.isEmpty()) return List.of();
        String ids = jobIds.stream().collect(java.util.stream.Collectors.joining(","));
        try {
            var response = restTemplate.exchange(
                    jobServiceUrl + "/api/jobs/batch?ids=" + ids,
                    HttpMethod.GET,
                    internalRequest(),
                    new ParameterizedTypeReference<JobApiResponse<List<JobSummary>>>() {}
            );
            if (response.getBody() != null && response.getBody().getData() != null) {
                return response.getBody().getData();
            }
        } catch (Exception e) {
            log.warn("Failed to fetch jobs by ids {}: {}", ids, e.getMessage());
        }
        return List.of();
    }

    public int deactivateExcessActiveJobs(String recruiterId, int keepCount) {
        try {
            var response = restTemplate.exchange(
                    jobServiceUrl + "/api/jobs/internal/deactivate-excess?recruiterId=" + recruiterId + "&keepCount=" + keepCount,
                    HttpMethod.POST,
                    internalRequest(),
                    new ParameterizedTypeReference<JobApiResponse<Integer>>() {}
            );
            if (response.getBody() != null && response.getBody().getData() != null) {
                return response.getBody().getData();
            }
        } catch (Exception e) {
            log.warn("Failed to deactivate excess jobs for recruiter {}: {}", recruiterId, e.getMessage());
        }
        return 0;
    }
}
