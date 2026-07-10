package vn.chuongpl.application_service.integration.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import vn.chuongpl.application_service.dtos.ApiResponse;
import vn.chuongpl.application_service.dtos.request.AssessmentGenerateRequest;
import vn.chuongpl.application_service.dtos.response.AssessmentGenerateResponse;
import vn.chuongpl.application_service.enums.ErrorCode;
import vn.chuongpl.application_service.exception.AppException;


@Slf4j
@Component
@RequiredArgsConstructor
public class AiEngineClient {

    final RestTemplate restTemplate;

    @Value("${app.ai-service.base-url}")
    String aiServiceBaseUrl;

    @Value("${app.gateway.internal-secret}")
    String internalSecret;

    public AssessmentGenerateResponse generateQuestions(AssessmentGenerateRequest request) {
        String url = aiServiceBaseUrl + "/api/ai/generate-assessment";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Gateway-Secret", internalSecret);
            headers.set("Content-Type", "application/json");
            
            org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null) {
                headers.set("X-User-Id", authentication.getName());
                String scope = authentication.getAuthorities().stream()
                        .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                        .collect(java.util.stream.Collectors.joining(" "));
                headers.set("X-User-Scope", scope);
            }
            
            HttpEntity<AssessmentGenerateRequest> entity = new HttpEntity<>(request, headers);
            ResponseEntity<ApiResponse<AssessmentGenerateResponse>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<>() {}
            );
            ApiResponse<AssessmentGenerateResponse> body = response.getBody();
            AssessmentGenerateResponse result = body == null ? null : body.getData();
            if (result == null) throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE);
            return result;
        } catch (AppException e) {
            throw e;
        } catch (HttpClientErrorException.BadRequest e) {
            String body = e.getResponseBodyAsString();
            if (body.contains("\"code\":8012") || body.contains("8012")) {
                throw new AppException(ErrorCode.AI_CREDIT_EXHAUSTED);
            }
            log.error("AI service call failed with BadRequest: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE);
        } catch (Exception e) {
            log.error("AI service call failed: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE);
        }
    }
}
