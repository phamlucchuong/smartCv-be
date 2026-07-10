package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import vn.chuongpl.user_service.features.recruiter.Recruiter;

import java.time.LocalDateTime;
import java.util.List;

@ChangeUnit(id = "V1_012__Add_platform_fee_fields_to_recruiters", order = "012", author = "codex")
public class V1_012__Add_platform_fee_fields_to_recruiters {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        List<Recruiter> recruiters = mongoTemplate.find(Query.query(Criteria.where("deleted").is(false)), Recruiter.class);
        for (Recruiter recruiter : recruiters) {
            if (recruiter.getPlatformFeeDueAt() != null) {
                continue;
            }
            LocalDateTime baseTime = recruiter.getCreatedAt() != null ? recruiter.getCreatedAt() : LocalDateTime.now();
            Update update = new Update()
                    .set("platform_fee_due_at", baseTime.plusMonths(1))
                    .set("platform_fee_last_paid_at", null)
                    .set("platform_fee_reminder_sent_at", null)
                    .set("platform_fee_locked_at", null);
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(recruiter.getId())),
                    update,
                    Recruiter.class
            );
        }
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        Query query = Query.query(Criteria.where("deleted").is(false));
        Update update = new Update()
                .unset("platform_fee_due_at")
                .unset("platform_fee_last_paid_at")
                .unset("platform_fee_reminder_sent_at")
                .unset("platform_fee_locked_at");
        mongoTemplate.updateMulti(query, update, Recruiter.class);
    }
}
