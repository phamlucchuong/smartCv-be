package vn.chuongpl.job_service.integration.applicationservice;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceClientTest {

    @Mock RestTemplate restTemplate;
    @InjectMocks ApplicationServiceClient client;

    @Test
    void getTopJobIds_shouldReturnJobIdsSortedByCount() {
        ReflectionTestUtils.setField(client, "applicationServiceUrl", "http://localhost:8083");
        ReflectionTestUtils.setField(client, "internalSecret", "super-secret");

        Map<String, Object> dto1 = Map.of("jobId", "job1", "count", 10);
        Map<String, Object> dto2 = Map.of("jobId", "job2", "count", 5);

        when(restTemplate.exchange(
                eq("http://localhost:8083/application/api/applications/top-jobs?limit=6"),
                eq(HttpMethod.GET),
                org.mockito.ArgumentMatchers.<HttpEntity<Void>>any(),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(Map.of("data", List.of(dto1, dto2))));

        List<String> result = client.getTopJobIds(6);

        assertEquals(2, result.size());
        assertEquals("job1", result.get(0));
        assertEquals("job2", result.get(1));
    }

    @Test
    void getTopJobIds_shouldReturnEmptyListWhenCallFails() {
        ReflectionTestUtils.setField(client, "applicationServiceUrl", "http://localhost:8083");
        ReflectionTestUtils.setField(client, "internalSecret", "secret");

        when(restTemplate.exchange(any(String.class), any(), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("connection refused"));

        List<String> result = client.getTopJobIds(6);

        assertTrue(result.isEmpty());
    }

    @Test
    void getTopJobIds_shouldReturnEmptyListWhenDataIsNull() {
        ReflectionTestUtils.setField(client, "applicationServiceUrl", "http://localhost:8083");
        ReflectionTestUtils.setField(client, "internalSecret", "secret");

        when(restTemplate.exchange(
                any(String.class), eq(HttpMethod.GET),
                org.mockito.ArgumentMatchers.<HttpEntity<Void>>any(),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(null));

        List<String> result = client.getTopJobIds(6);

        assertTrue(result.isEmpty());
    }
}
