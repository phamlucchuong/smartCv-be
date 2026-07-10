package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;

@ChangeUnit(id = "V1_013__Set_package_categories", order = "013", author = "codex")
public class V1_013__Set_package_categories {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is("fee")),
                new Update().set("category", "PLATFORM_FEE"),
                ServicePackage.class
        );
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("_id").ne("fee").and("category").exists(false)),
                new Update().set("category", "STANDARD"),
                ServicePackage.class
        );
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        mongoTemplate.updateMulti(
                new Query(),
                new Update().unset("category"),
                ServicePackage.class
        );
    }
}
