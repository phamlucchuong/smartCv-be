package vn.chuongpl.user_service.features.payment;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.recruiter.Recruiter;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class PackageExpirationScheduler {

    MongoTemplate mongoTemplate;
    ServicePackageRepository servicePackageRepository;

    @Scheduled(fixedDelay = 60_000)
    public void expirePackages() {
        LocalDateTime now = LocalDateTime.now();
        ServicePackage freePackage = servicePackageRepository.findById("free").orElse(null);

        expireCandidates(now);
        expireRecruiters(now, freePackage);
    }

    private void expireCandidates(LocalDateTime now) {
        Query query = Query.query(new Criteria().andOperator(
                Criteria.where("deleted").is(false),
                Criteria.where("package_expires_at").ne(null),
                Criteria.where("package_expires_at").lte(now),
                Criteria.where("active_package_id").ne("free")
        ));
        Update update = new Update()
                .set("active_package_id", "free")
                .unset("package_activated_at")
                .unset("package_expires_at")
                .set("monthly_ai_credits_used", 0)
                .set("monthly_ai_credits_month", java.time.YearMonth.from(now).toString())
                .set("updated_at", now);

        long modified = mongoTemplate.updateMulti(query, update, Candidate.class).getModifiedCount();
        if (modified > 0) {
            log.info("[Scheduler] Reset {} expired candidate package(s) to free", modified);
        }
    }

    private void expireRecruiters(LocalDateTime now, ServicePackage freePackage) {
        Query query = Query.query(new Criteria().andOperator(
                Criteria.where("deleted").is(false),
                Criteria.where("package_expires_at").ne(null),
                Criteria.where("package_expires_at").lte(now),
                Criteria.where("active_package_id").ne("free")
        ));
        Update update = new Update()
                .set("active_package_id", "free")
                .unset("package_activated_at")
                .unset("package_expires_at")
                .set("quota_job_post", resolveFreeJobQuota(freePackage))
                .set("quota_cv_views", resolveFreeCvQuota(freePackage))
                .set("monthly_ai_credits_used", 0)
                .set("monthly_ai_credits_month", java.time.YearMonth.from(now).toString())
                .set("updated_at", now);

        long modified = mongoTemplate.updateMulti(query, update, Recruiter.class).getModifiedCount();
        if (modified > 0) {
            log.info("[Scheduler] Reset {} expired recruiter package(s) to free", modified);
        }
    }

    private int resolveFreeJobQuota(ServicePackage freePackage) {
        if (freePackage == null || freePackage.getJobLimit() == null) {
            return 0;
        }
        return freePackage.getJobLimit();
    }

    private int resolveFreeCvQuota(ServicePackage freePackage) {
        if (freePackage == null || freePackage.getCvLimit() == null) {
            return 0;
        }
        return freePackage.getCvLimit();
    }
}
