package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import vn.chuongpl.user_service.features.user.User;

@ChangeUnit(id = "V1_004__Verify_admin_user", order = "004", author = "chuongpl")
public class V1_004__Verify_admin_user {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        Query query = Query.query(Criteria.where("email").is("admin@gmail.com"));
        mongoTemplate.updateFirst(query, Update.update("verified", true), User.class);
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        Query query = Query.query(Criteria.where("email").is("admin@gmail.com"));
        mongoTemplate.updateFirst(query, Update.update("verified", false), User.class);
    }
}
