package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;

import java.time.LocalDateTime;
import java.util.List;

@ChangeUnit(id = "V1_006__Seed_service_packages", order = "006", author = "codex")
public class V1_006__Seed_service_packages {

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        LocalDateTime now = LocalDateTime.now();
        List<ServicePackage> packages = List.of(
                ServicePackage.builder()
                        .id("free")
                        .name("Free")
                        .price(0L)
                        .aiCredits(10)
                        .jobLimit(5)
                        .cvLimit(3)
                        .durationDays(null)
                        .featured(false)
                        .features(List.of("Hỗ trợ cơ bản", "Phân tích CV cơ bản"))
                        .createdAt(now)
                        .updatedAt(now)
                        .build(),
                ServicePackage.builder()
                        .id("plus")
                        .name("Plus")
                        .price(10000L)
                        .aiCredits(20)
                        .jobLimit(10)
                        .cvLimit(10)
                        .durationDays(30)
                        .featured(true)
                        .features(List.of("Hỗ trợ email 24/7", "Phân tích CV nâng cao", "Sàng lọc AI cơ bản"))
                        .createdAt(now)
                        .updatedAt(now)
                        .build(),
                ServicePackage.builder()
                        .id("pro")
                        .name("Pro")
                        .price(20000L)
                        .aiCredits(30)
                        .jobLimit(15)
                        .cvLimit(-1)
                        .durationDays(30)
                        .featured(false)
                        .features(List.of("Hỗ trợ ưu tiên", "Sàng lọc AI nâng cao", "Bảng ATS toàn diện"))
                        .createdAt(now)
                        .updatedAt(now)
                        .build()
        );

        packages.forEach(mongoTemplate::save);
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        mongoTemplate.remove(Query.query(Criteria.where("_id").in(List.of("free", "plus", "pro"))), ServicePackage.class);
    }
}
