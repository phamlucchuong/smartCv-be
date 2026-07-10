package vn.chuongpl.application_service.features.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApplicationAggregateServiceTest {

    @Mock MongoTemplate mongoTemplate;
    @InjectMocks ApplicationAggregateService aggregateService;

    @Test
    void getTopJobsByApplicationCount_returnsJobsSortedByCount() {
        TopJobCountDto dto1 = new TopJobCountDto();
        dto1.setJobId("job1");
        dto1.setCount(10);
        TopJobCountDto dto2 = new TopJobCountDto();
        dto2.setJobId("job2");
        dto2.setCount(5);

        @SuppressWarnings("unchecked")
        AggregationResults<TopJobCountDto> mockResults = mock(AggregationResults.class);
        when(mockResults.getMappedResults()).thenReturn(List.of(dto1, dto2));
        when(mongoTemplate.aggregate(any(Aggregation.class), eq("applications"), eq(TopJobCountDto.class)))
                .thenReturn(mockResults);

        List<TopJobCountDto> result = aggregateService.getTopJobsByApplicationCount(6);

        assertEquals(2, result.size());
        assertEquals("job1", result.get(0).getJobId());
        assertEquals(10L, result.get(0).getCount());
    }

    @Test
    void getTopJobsByApplicationCount_returnsEmptyListWhenNoApplications() {
        @SuppressWarnings("unchecked")
        AggregationResults<TopJobCountDto> mockResults = mock(AggregationResults.class);
        when(mockResults.getMappedResults()).thenReturn(List.of());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq("applications"), eq(TopJobCountDto.class)))
                .thenReturn(mockResults);

        List<TopJobCountDto> result = aggregateService.getTopJobsByApplicationCount(6);

        assertTrue(result.isEmpty());
    }
}
