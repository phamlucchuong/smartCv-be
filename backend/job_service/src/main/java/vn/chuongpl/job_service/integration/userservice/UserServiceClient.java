package vn.chuongpl.job_service.integration.userservice;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserServiceClient {

    private final RestTemplate restTemplate;

    @Value("${app.user-service-url:http://localhost:8081}")
    private String userServiceUrl;

    @Value("${app.gateway-internal-secret:changeme}")
    private String internalSecret;

    private String getBaseUrl() {
        if (userServiceUrl == null) return "";
        String base = userServiceUrl.trim();
        if (base.endsWith("/user")) {
            return base;
        }
        if (base.endsWith("/user/")) {
            return base.substring(0, base.length() - 1);
        }
        if (base.endsWith("/")) {
            return base + "user";
        }
        return base + "/user";
    }

    /** Cache of userId -> Recruiter.id. The mapping is immutable, so no eviction is needed. */
    private final Map<String, String> recruiterIdCache = new ConcurrentHashMap<>();

    /** Recruiter profile carrying the canonical Recruiter.id plus approval status. */
    public record RecruiterProfileDto(String recruiterId, String status) {
        public boolean isApproved() {
            return "APPROVED".equals(status);
        }
    }

    /** Fetches the recruiter profile (recruiterId + status) for a given JWT userId. */
    public RecruiterProfileDto getRecruiterProfile(String userId) {
        String url = getBaseUrl() + "/api/internal/recruiters/by-user/" + userId;
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-Gateway-Secret", internalSecret);
            org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, entity, Map.class);
            if (response.getBody() != null) {
                Object data = response.getBody().get("data");
                if (data instanceof Map<?, ?> dataMap) {
                    String recruiterId = dataMap.get("recruiterId") != null ? dataMap.get("recruiterId").toString() : null;
                    String status = dataMap.get("status") != null ? dataMap.get("status").toString() : null;
                    if (recruiterId != null) recruiterIdCache.put(userId, recruiterId);
                    return new RecruiterProfileDto(recruiterId, status);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch recruiter profile for userId={}: {}", userId, e.getMessage());
        }
        return new RecruiterProfileDto(null, null);
    }

    /** Resolves a JWT userId to the canonical Recruiter.id (cached). Returns null if not found. */
    public String resolveRecruiterId(String userId) {
        if (userId == null) return null;
        String cached = recruiterIdCache.get(userId);
        if (cached != null) return cached;
        return getRecruiterProfile(userId).recruiterId();
    }

    public RecruiterStatusDto getRecruiterStatus(String userId) {
        String url = getBaseUrl() + "/api/internal/recruiters/by-user/" + userId;
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-Gateway-Secret", internalSecret);
            org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, entity, Map.class);
            if (response.getBody() != null) {
                Object data = response.getBody().get("data");
                if (data instanceof Map<?, ?> dataMap) {
                    Object status = dataMap.get("status");
                    return new RecruiterStatusDto(status != null ? status.toString() : null);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch recruiter status for userId={}: {}", userId, e.getMessage());
        }
        return new RecruiterStatusDto(null);
    }

    public record CompanyData(String id, String name, String logoUrl, String coverImageUrl, String industry, String location) {}

    public CompanyData getCompanyData(String userId) {
        String url = getBaseUrl() + "/api/companies/by-recruiter/" + userId;
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-Gateway-Secret", internalSecret);
            org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, entity, Map.class);
            if (response.getBody() != null) {
                Object data = response.getBody().get("data");
                if (data instanceof Map<?, ?> dataMap) {
                    String id = dataMap.get("id") != null ? dataMap.get("id").toString() : null;
                    String name = dataMap.get("name") != null ? dataMap.get("name").toString() : null;
                    String logoUrl = dataMap.get("logoUrl") != null ? dataMap.get("logoUrl").toString() : null;
                    String coverImageUrl = dataMap.get("coverImageUrl") != null ? dataMap.get("coverImageUrl").toString() : null;
                    String industry = dataMap.get("industry") != null ? dataMap.get("industry").toString() : null;
                    String location = dataMap.get("location") != null ? dataMap.get("location").toString() : null;
                    return new CompanyData(id, name, logoUrl, coverImageUrl, industry, location);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch company data for userId={}: {}", userId, e.getMessage());
        }
        return null;
    }

    public List<CompanyData> getCompaniesByCategory(String category, int limit) {
        String url = getBaseUrl() + "/api/internal/recruiters/by-category?category=" + category + "&limit=" + limit;
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-Gateway-Secret", internalSecret);
            org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, entity, Map.class);
            if (response.getBody() != null) {
                Object data = response.getBody().get("data");
                if (data instanceof List<?> list) {
                    return list.stream()
                            .filter(item -> item instanceof Map)
                            .map(item -> {
                                Map<?, ?> m = (Map<?, ?>) item;
                                return new CompanyData(
                                        m.get("id") != null ? m.get("id").toString() : null,
                                        m.get("name") != null ? m.get("name").toString() : null,
                                        m.get("logoUrl") != null ? m.get("logoUrl").toString() : null,
                                        m.get("coverImageUrl") != null ? m.get("coverImageUrl").toString() : null,
                                        m.get("industry") != null ? m.get("industry").toString() : null,
                                        m.get("location") != null ? m.get("location").toString() : null
                                );
                            })
                            .toList();
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch companies by category={}: {}", category, e.getMessage());
        }
        return Collections.emptyList();
    }

    public String getCompanyId(String userId) {
        CompanyData data = getCompanyData(userId);
        return data != null ? data.id() : null;
    }

    public String getRecruiterEmail(String userId) {
        String url = getBaseUrl() + "/api/internal/recruiters/by-user/" + userId;
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-Gateway-Secret", internalSecret);
            org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, entity, Map.class);
            if (response.getBody() != null) {
                Object data = response.getBody().get("data");
                if (data instanceof Map<?, ?> dataMap) {
                    Object email = dataMap.get("email");
                    return email != null ? email.toString() : null;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch recruiter email for userId={}: {}", userId, e.getMessage());
        }
        return null;
    }
}
