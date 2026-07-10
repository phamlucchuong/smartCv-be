package vn.chuongpl.job_service.integration.applicationservice;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class ApplicationServiceClient {

    private final RestTemplate restTemplate;

    @Value("${app.application-service-url:http://localhost:8083}")
    private String applicationServiceUrl;

    @Value("${app.gateway-internal-secret:changeme}")
    private String internalSecret;

    public List<Map<String, Object>> getTopJobs(int limit) {
        String url = applicationServiceUrl + "/application/api/applications/top-jobs?limit=" + limit;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Gateway-Secret", internalSecret);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getBody() == null) return Collections.emptyList();
            Object data = response.getBody().get("data");
            if (data instanceof List<?> list) {
                return list.stream()
                        .filter(item -> item instanceof Map)
                        .map(item -> {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> m = (Map<String, Object>) item;
                            return m;
                        })
                        .toList();
            }
        } catch (Exception e) {
            log.warn("Failed to fetch top jobs with counts from application-service: {}", e.getMessage());
        }
        return Collections.emptyList();
    }

    public List<String> getTopJobIds(int limit) {
        String url = applicationServiceUrl + "/application/api/applications/top-jobs?limit=" + limit;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Gateway-Secret", internalSecret);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getBody() == null) return Collections.emptyList();
            Object data = response.getBody().get("data");
            if (data instanceof List<?> list) {
                return list.stream()
                        .filter(item -> item instanceof Map)
                        .map(item -> (Map<?, ?>) item)
                        .map(m -> m.get("jobId"))
                        .filter(id -> id != null)
                        .map(Object::toString)
                        .toList();
            }
        } catch (Exception e) {
            log.warn("Failed to fetch top job ids from application-service: {}", e.getMessage());
        }
        return Collections.emptyList();
    }
}
