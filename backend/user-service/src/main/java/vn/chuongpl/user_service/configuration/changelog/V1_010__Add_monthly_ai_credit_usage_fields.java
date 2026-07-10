package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.YearMonth;

@ChangeUnit(id = "V1_010__Add_monthly_ai_credit_usage_fields", order = "010", author = "codex")
public class V1_010__Add_monthly_ai_credit_usage_fields {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        String currentMonth = YearMonth.now().toString();
        Update update = new Update()
                .set("monthly_ai_credits_used", 0)
                .set("monthly_ai_credits_month", currentMonth);
        mongoTemplate.updateMulti(Query.query(Criteria.where("deleted").ne(true)), update, "candidates");
        mongoTemplate.updateMulti(Query.query(Criteria.where("deleted").ne(true)), update, "recruiters");
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        Update update = new Update()
                .unset("monthly_ai_credits_used")
                .unset("monthly_ai_credits_month");
        mongoTemplate.updateMulti(new Query(), update, "candidates");
        mongoTemplate.updateMulti(new Query(), update, "recruiters");
    }
}
