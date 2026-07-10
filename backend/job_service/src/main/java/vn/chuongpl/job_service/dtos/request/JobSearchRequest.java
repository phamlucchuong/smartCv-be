package vn.chuongpl.job_service.dtos.request;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.job_service.enums.ExperienceLevel;
import vn.chuongpl.job_service.enums.JobCategory;
import vn.chuongpl.job_service.enums.JobType;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class JobSearchRequest {
    String keyword;
    String location;
    Double salaryMin;
    Double salaryMax;
    JobType jobType;
    ExperienceLevel experienceLevel;
    List<String> skills;
    JobCategory category;
    String sortBy;
    String sortDir;
    @Builder.Default int page = 1;
    @Builder.Default int size = 10;
}
