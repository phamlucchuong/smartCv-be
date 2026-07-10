package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

@ChangeUnit(id = "V1_009__Backfill_duration_days_for_service_packages", order = "009", author = "codex")
public class V1_009__Backfill_duration_days_for_service_packages {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is("free")),
                new Update().set("duration_days", null),
                "service_packages");
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is("plus")),
                new Update().set("duration_days", 30),
                "service_packages");
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is("pro")),
                new Update().set("duration_days", 30),
                "service_packages");
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").in("free", "plus", "pro")),
                new Update().unset("duration_days"),
                "service_packages");
    }
}
