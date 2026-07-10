package vn.chuongpl.ai_engine_service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.integration.user.CvInfoResponse;
import vn.chuongpl.ai_engine_service.integration.user.UserClient;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserClientTest {

    @Mock
    RestTemplate restTemplate;

    UserClient userClient;

    @BeforeEach
    void setUp() {
        userClient = new UserClient(restTemplate);
        ReflectionTestUtils.setField(userClient, "baseUrl", "http://localhost:8081/user");
        ReflectionTestUtils.setField(userClient, "gatewaySecret", "test-secret");
    }

    @Test
    void getCvInfo_returns_parsed_response() {
        Map<String, Object> body = Map.of("data", Map.of(
                "cvId", "cv-1",
                "cvUrl", "https://s3.example.com/cv.pdf",
                "filename", "cv.pdf",
                "ownerId", "user-1"
        ));
        when(restTemplate.exchange(
                eq("http://localhost:8081/user/api/internal/candidates/cvs/cv-1"),
                eq(HttpMethod.GET),
                any(),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(body));

        CvInfoResponse result = userClient.getCvInfo("cv-1");

        assertThat(result.cvId()).isEqualTo("cv-1");
        assertThat(result.cvUrl()).isEqualTo("https://s3.example.com/cv.pdf");
        assertThat(result.filename()).isEqualTo("cv.pdf");
        assertThat(result.ownerId()).isEqualTo("user-1");
    }

    @Test
    void getCvInfo_throws_CV_NOT_FOUND_on_404() {
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenThrow(HttpClientErrorException.NotFound.class);

        assertThatThrownBy(() -> userClient.getCvInfo("missing"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.CV_NOT_FOUND));
    }

    @Test
    void getCvInfo_throws_USER_SERVICE_UNAVAILABLE_on_generic_error() {
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("connection refused"));

        assertThatThrownBy(() -> userClient.getCvInfo("cv-1"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.USER_SERVICE_UNAVAILABLE));
    }

    @Test
    void updateCvAnalysis_calls_patch_endpoint() {
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.PATCH), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of()));

        userClient.updateCvAnalysis("cv-1", "{\"score\":78}", "DONE");

        verify(restTemplate).exchange(
                eq("http://localhost:8081/user/api/internal/candidates/cvs/cv-1/analysis"),
                eq(HttpMethod.PATCH),
                any(),
                eq(Map.class)
        );
    }

    @Test
    void updateCvAnalysis_silently_continues_on_error() {
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.PATCH), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("timeout"));

        // Should NOT throw
        userClient.updateCvAnalysis("cv-1", "{}", "DONE");
    }
}
