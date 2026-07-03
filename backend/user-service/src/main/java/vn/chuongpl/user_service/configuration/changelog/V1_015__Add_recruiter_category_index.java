package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

@ChangeUnit(id = "V1_015__Add_recruiter_category_index", order = "015", author = "smartcv")
public class V1_015__Add_recruiter_category_index {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        mongoTemplate.indexOps("recruiters").ensureIndex(
                new Index("category", Sort.Direction.ASC)
        );
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        mongoTemplate.indexOps("recruiters").dropIndex("category_1");
    }
}
