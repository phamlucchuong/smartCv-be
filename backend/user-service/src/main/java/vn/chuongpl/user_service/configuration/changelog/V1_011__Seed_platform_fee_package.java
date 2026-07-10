package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import vn.chuongpl.user_service.features.servicepackage.PackageCategory;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;

import java.time.LocalDateTime;
import java.util.List;

@ChangeUnit(id = "V1_011__Seed_platform_fee_package", order = "011", author = "codex")
public class V1_011__Seed_platform_fee_package {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        LocalDateTime now = LocalDateTime.now();
        ServicePackage feePackage = ServicePackage.builder()
                .id("fee")
                .name("Phí sàn")
                .price(10000L)
                .aiCredits(0)
                .jobLimit(0)
                .cvLimit(0)
                .durationDays(30)
                .category(PackageCategory.PLATFORM_FEE)
                .featured(false)
                .features(List.of("Thanh toán phí sàn hàng tháng"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        mongoTemplate.save(feePackage);
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        mongoTemplate.remove(Query.query(Criteria.where("_id").is("fee")), ServicePackage.class);
    }
}
