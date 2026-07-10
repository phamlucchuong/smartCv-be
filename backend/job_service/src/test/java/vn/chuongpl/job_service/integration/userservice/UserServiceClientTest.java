package vn.chuongpl.job_service.integration.userservice;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceClientTest {

    @Mock
    RestTemplate restTemplate;

    @InjectMocks
    UserServiceClient userServiceClient;

    @Test
    void getRecruiterStatus_shouldCallInternalEndpointWithGatewaySecretHeader() {
        ReflectionTestUtils.setField(userServiceClient, "userServiceUrl", "http://localhost:8081");
        ReflectionTestUtils.setField(userServiceClient, "internalSecret", "super-secret");

        when(restTemplate.exchange(
                eq("http://localhost:8081/user/api/internal/recruiters/by-user/user-1"),
                eq(HttpMethod.GET),
                org.mockito.ArgumentMatchers.<HttpEntity<Void>>any(),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(Map.of(
                "data", Map.of("status", "APPROVED")
        )));

        RecruiterStatusDto status = userServiceClient.getRecruiterStatus("user-1");

        ArgumentCaptor<HttpEntity<Void>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(
                eq("http://localhost:8081/user/api/internal/recruiters/by-user/user-1"),
                eq(HttpMethod.GET),
                entityCaptor.capture(),
                eq(Map.class)
        );

        assertEquals("super-secret", entityCaptor.getValue().getHeaders().getFirst("X-Gateway-Secret"));
        assertEquals("APPROVED", status.status());
    }

    @Test
    void getRecruiterEmail_shouldReturnEmailFromRecruiterEndpoint() {
        ReflectionTestUtils.setField(userServiceClient, "userServiceUrl", "http://localhost:8081");
        ReflectionTestUtils.setField(userServiceClient, "internalSecret", "super-secret");

        when(restTemplate.exchange(
                eq("http://localhost:8081/user/api/internal/recruiters/by-user/user-1"),
                eq(HttpMethod.GET),
                org.mockito.ArgumentMatchers.<HttpEntity<Void>>any(),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(Map.of(
                "data", Map.of("email", "owner@company.com")
        )));

        String email = userServiceClient.getRecruiterEmail("user-1");

        assertEquals("owner@company.com", email);
    }

    @Test
    void getRecruiterEmail_shouldReturnNullWhenCallFails() {
        ReflectionTestUtils.setField(userServiceClient, "userServiceUrl", "http://localhost:8081");
        ReflectionTestUtils.setField(userServiceClient, "internalSecret", "secret");

        when(restTemplate.exchange(any(String.class), any(), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("connection refused"));

        String email = userServiceClient.getRecruiterEmail("user-1");

        org.junit.jupiter.api.Assertions.assertNull(email);
    }

    @Test
    void getCompanyId_shouldReturnIdFromCompanyByRecruiterEndpoint() {
        ReflectionTestUtils.setField(userServiceClient, "userServiceUrl", "http://localhost:8081");
        ReflectionTestUtils.setField(userServiceClient, "internalSecret", "super-secret");

        when(restTemplate.exchange(
                eq("http://localhost:8081/user/api/companies/by-recruiter/user-1"),
                eq(HttpMethod.GET),
                org.mockito.ArgumentMatchers.<HttpEntity<Void>>any(),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(Map.of(
                "data", Map.of("id", "company-uuid-123")
        )));

        String companyId = userServiceClient.getCompanyId("user-1");

        assertEquals("company-uuid-123", companyId);
    }

    @Test
    void getCompanyId_shouldReturnNullWhenCallFails() {
        ReflectionTestUtils.setField(userServiceClient, "userServiceUrl", "http://localhost:8081");
        ReflectionTestUtils.setField(userServiceClient, "internalSecret", "secret");

        when(restTemplate.exchange(any(String.class), any(), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("connection refused"));

        String companyId = userServiceClient.getCompanyId("user-1");

        org.junit.jupiter.api.Assertions.assertNull(companyId);
    }
}
