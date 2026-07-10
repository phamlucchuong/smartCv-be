package vn.chuongpl.ai_engine_service.integration.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserClient {

    private final RestTemplate restTemplate;

    @Value("${app.user-service.base-url}")
    private String baseUrl;

    @Value("${app.gateway.internal-secret}")
    private String gatewaySecret;

    public void mergeSkills(String userId, List<String> skills) {
        try {
            List<String> safeSkills = skills == null ? Collections.emptyList() : skills;
            restTemplate.exchange(
                    baseUrl + "/api/internal/candidates/by-user/" + userId + "/skills",
                    HttpMethod.PATCH,
                    new HttpEntity<>(Map.of("skills", safeSkills), buildInternalHeaders()),
                    Void.class
            );
        } catch (Exception e) {
            log.error("Failed to merge skills for userId={}: {}", userId, e.getMessage());
        }
    }

    public CvInfoResponse getCvInfo(String cvId) {
        try {
            var response = restTemplate.exchange(
                    baseUrl + "/api/internal/candidates/cvs/" + cvId,
                    HttpMethod.GET,
                    new HttpEntity<>(buildInternalHeaders()),
                    Map.class
            );
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) Objects.requireNonNull(
                    response.getBody()).get("data");
            return new CvInfoResponse(
                    (String) data.get("cvId"),
                    (String) data.get("cvUrl"),
                    (String) data.get("filename"),
                    (String) data.get("ownerId")
            );
        } catch (HttpClientErrorException.NotFound e) {
            throw new AppException(ErrorCode.CV_NOT_FOUND);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to get CV info for cvId={}: {}", cvId, e.getMessage());
            throw new AppException(ErrorCode.USER_SERVICE_UNAVAILABLE);
        }
    }

    public void updateCvAnalysis(String cvId, String analysisResultJson, String status) {
        try {
            restTemplate.exchange(
                    baseUrl + "/api/internal/candidates/cvs/" + cvId + "/analysis",
                    HttpMethod.PATCH,
                    new HttpEntity<>(
                            Map.of("analysisResult", analysisResultJson, "analysisStatus", status),
                            buildInternalHeaders()),
                    Map.class
            );
        } catch (Exception e) {
            log.warn("Failed to persist CV analysis for cvId={}: {}", cvId, e.getMessage());
        }
    }

    public void consumeCandidateAiCredit(String userId) {
        consumeAiCredit(baseUrl + "/api/internal/candidates/by-user/" + userId + "/consume-ai-credit");
    }

    public void consumeRecruiterAiCredit(String userId) {
        consumeAiCredit(baseUrl + "/api/internal/recruiters/by-user/" + userId + "/consume-ai-credit");
    }

    private void consumeAiCredit(String url) {
        try {
            restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    new HttpEntity<>(buildInternalHeaders()),
                    Map.class
            );
        } catch (HttpClientErrorException.BadRequest e) {
            throw new vn.chuongpl.ai_engine_service.exception.AppException(ErrorCode.AI_CREDIT_EXHAUSTED);
        } catch (HttpClientErrorException.NotFound e) {
            throw new vn.chuongpl.ai_engine_service.exception.AppException(ErrorCode.UNAUTHORIZED);
        } catch (Exception e) {
            log.warn("Failed to consume AI credit via {}: {}", url, e.getMessage());
            throw new vn.chuongpl.ai_engine_service.exception.AppException(ErrorCode.USER_SERVICE_UNAVAILABLE);
        }
    }

    private HttpHeaders buildInternalHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Gateway-Secret", gatewaySecret);
        headers.set("X-User-Id", "ai-engine");
        headers.set("X-User-Scope", "ROLE_ADMIN");
        return headers;
    }
}
