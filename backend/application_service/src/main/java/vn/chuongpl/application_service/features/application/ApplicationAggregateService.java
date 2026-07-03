package vn.chuongpl.application_service.features.application;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class ApplicationAggregateService {

    MongoTemplate mongoTemplate;

    public List<TopJobCountDto> getTopJobsByApplicationCount(int limit) {
        java.time.LocalDateTime startOfMonth = java.time.LocalDateTime.now()
                .withDayOfMonth(1)
                .withHour(0)
                .withMinute(0)
                .withSecond(0)
                .withNano(0);

        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("deleted").is(false)
                        .and("appliedAt").gte(startOfMonth)),
                Aggregation.group("job_id").count().as("count"),
                Aggregation.project("count").and("_id").as("jobId"),
                Aggregation.sort(Sort.by(Sort.Direction.DESC, "count")),
                Aggregation.limit(limit)
        );
        AggregationResults<TopJobCountDto> results =
                mongoTemplate.aggregate(agg, "applications", TopJobCountDto.class);
        return results.getMappedResults();
    }
}
