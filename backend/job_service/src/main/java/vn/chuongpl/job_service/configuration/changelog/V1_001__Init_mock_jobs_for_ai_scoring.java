package vn.chuongpl.job_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import vn.chuongpl.job_service.enums.ExperienceLevel;
import vn.chuongpl.job_service.enums.JobModerationStatus;
import vn.chuongpl.job_service.enums.JobType;
import vn.chuongpl.job_service.enums.JobVisibilityStatus;
import vn.chuongpl.job_service.features.job.Job;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@ChangeUnit(id = "V1_001__Init_mock_jobs_for_ai_scoring", order = "001", author = "chuongpl")
public class V1_001__Init_mock_jobs_for_ai_scoring {
    private static final String HIGH_PASS_JOB_ID = "mock-job-backend-java-high-pass";
    private static final String LOW_PASS_JOB_ID = "mock-job-backend-java-low-pass";
    private static final String MOCK_RECRUITER_ID = "mock-recruiter-user";

    @Execution
    public void initData(MongoTemplate mongoTemplate) {
        if (!mongoTemplate.exists(Query.query(Criteria.where("_id").is(HIGH_PASS_JOB_ID)), Job.class)) {
            Job highPassJob = Job.builder()
                    .id(HIGH_PASS_JOB_ID)
                    .recruiterId(MOCK_RECRUITER_ID)
                    .title("Backend Java Developer (High Match Test)")
                    .description("Build and maintain Java Spring Boot microservices, REST APIs, and integrations.")
                    .company("SmartCV Test Company")
                    .location("Ho Chi Minh City")
                    .salaryMin(1200.0)
                    .salaryMax(2200.0)
                    .jobType(JobType.FULL_TIME)
                    .experienceLevel(ExperienceLevel.JUNIOR)
                    .skills(List.of("Java", "Spring Boot", "REST API", "MySQL", "Docker", "Git"))
                    .requirements(List.of(
                            "1+ years with Java and Spring Boot",
                            "Understand RESTful API design",
                            "Basic SQL and database design",
                            "Comfortable with Docker and Git workflow"
                    ))
                    .benefits(List.of("Laptop", "Health insurance", "Flexible hours"))
                    .moderationStatus(JobModerationStatus.PUBLISHED)
                    .visibilityStatus(JobVisibilityStatus.ACTIVE)
                    .deadline(LocalDate.now().plusMonths(3))
                    .deleted(false)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            mongoTemplate.save(highPassJob);
        }

        if (!mongoTemplate.exists(Query.query(Criteria.where("_id").is(LOW_PASS_JOB_ID)), Job.class)) {
            Job lowPassJob = Job.builder()
                    .id(LOW_PASS_JOB_ID)
                    .recruiterId(MOCK_RECRUITER_ID)
                    .title("Embedded C/C++ Engineer (Low Match Test)")
                    .description("Develop firmware for embedded systems with real-time constraints and hardware integration.")
                    .company("SmartCV Test Company")
                    .location("Da Nang")
                    .salaryMin(1500.0)
                    .salaryMax(2600.0)
                    .jobType(JobType.FULL_TIME)
                    .experienceLevel(ExperienceLevel.MIDDLE)
                    .skills(List.of("C", "C++", "RTOS", "STM32", "Embedded Linux", "CAN Bus"))
                    .requirements(List.of(
                            "2+ years in embedded systems programming",
                            "Strong debugging with oscilloscope and logic analyzer",
                            "Experience with low-level device drivers"
                    ))
                    .benefits(List.of("Annual bonus", "Hardware lab access"))
                    .moderationStatus(JobModerationStatus.PUBLISHED)
                    .visibilityStatus(JobVisibilityStatus.ACTIVE)
                    .deadline(LocalDate.now().plusMonths(3))
                    .deleted(false)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            mongoTemplate.save(lowPassJob);
        }
    }

    @RollbackExecution
    public void rollback() {
    }
}
