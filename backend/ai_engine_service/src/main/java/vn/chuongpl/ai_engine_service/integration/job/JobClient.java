package vn.chuongpl.ai_engine_service.integration.job;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class JobClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.job-service.base-url}")
    private String jobServiceBaseUrl;

    @Value("${app.gateway.internal-secret}")
    private String internalSecret;

    public JobSummary getJobById(String jobId) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            ResponseEntity<String> response = restTemplate.exchange(
                    jobServiceBaseUrl + "/api/jobs/" + jobId,
                    HttpMethod.GET,
                    entity,
                    String.class
            );

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode data = root.path("data");
            if (data.isMissingNode() || data.isNull()) {
                throw new AppException(ErrorCode.JOB_NOT_FOUND);
            }
            return toJobSummary(data);
        } catch (AppException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Job service unavailable: {}", e.getMessage());
            throw new AppException(ErrorCode.JOB_SERVICE_UNAVAILABLE);
        } catch (Exception e) {
            throw new AppException(ErrorCode.JOB_NOT_FOUND);
        }
    }

    public List<JobSummary> getActiveJobs(int page, int size) {
        try {
            HttpEntity<Void> entity = new HttpEntity<>(buildHeaders());
            String url = jobServiceBaseUrl + "/api/jobs?page=" + page + "&size=" + size;
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode content = root.path("data").path("content");
            if (!content.isArray()) {
                return Collections.emptyList();
            }

            List<JobSummary> jobs = new ArrayList<>();
            for (JsonNode node : content) {
                jobs.add(toJobSummary(node));
            }
            return jobs;
        } catch (RestClientException e) {
            log.error("[JobSuggestions][FetchActiveJobs] Job service unavailable", e);
            throw new AppException(ErrorCode.JOB_SERVICE_UNAVAILABLE);
        } catch (Exception e) {
            log.error("[JobSuggestions][FetchActiveJobs] Failed to parse active jobs response", e);
            return Collections.emptyList();
        }
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Gateway-Secret", internalSecret);
        headers.set("X-User-Id", "ai-engine");
        headers.set("X-User-Scope", "ROLE_ADMIN");
        return headers;
    }

    private JobSummary toJobSummary(JsonNode data) {
        return new JobSummary(
                data.path("id").asText(),
                data.path("title").asText(),
                data.path("company").asText(),
                data.path("description").asText(),
                toStringList(data.path("skills")),
                toStringList(data.path("requirements")),
                data.path("experienceLevel").asText()
        );
    }

    private List<String> toStringList(JsonNode node) {
        if (!node.isArray()) return Collections.emptyList();
        List<String> items = new ArrayList<>();
        for (JsonNode n : node) {
            items.add(n.asText());
        }
        return items;
    }
}
