package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;

@ChangeUnit(id = "V1_008__Add_package_activation_fields", order = "008", author = "codex")
public class V1_008__Add_package_activation_fields {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        // no-op: activePackageId, packageActivatedAt, packageExpiresAt default to null
        // on existing Recruiter and Candidate documents (no active package = free tier)
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        // no-op
    }
}
