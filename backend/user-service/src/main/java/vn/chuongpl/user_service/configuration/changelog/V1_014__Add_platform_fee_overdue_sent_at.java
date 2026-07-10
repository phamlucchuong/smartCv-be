package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import vn.chuongpl.user_service.features.recruiter.Recruiter;

@ChangeUnit(id = "V1_014__Add_platform_fee_overdue_sent_at", order = "014", author = "codex")
public class V1_014__Add_platform_fee_overdue_sent_at {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        mongoTemplate.updateMulti(
                new Query(),
                new Update().set("platform_fee_overdue_sent_at", null),
                Recruiter.class
        );
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        mongoTemplate.updateMulti(
                new Query(),
                new Update().unset("platform_fee_overdue_sent_at"),
                Recruiter.class
        );
    }
}
