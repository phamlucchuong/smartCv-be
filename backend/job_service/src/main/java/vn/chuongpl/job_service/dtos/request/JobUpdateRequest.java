package vn.chuongpl.job_service.dtos.request;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.job_service.enums.ExperienceLevel;
import vn.chuongpl.job_service.enums.JobCategory;
import vn.chuongpl.job_service.enums.JobType;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class JobUpdateRequest {
    String title;
    String description;
    String company;
    String location;
    Double salaryMin;
    Double salaryMax;
    JobType jobType;
    ExperienceLevel experienceLevel;
    List<String> skills;
    List<String> requirements;
    List<String> benefits;
    LocalDate deadline;
    Integer openings;
    Integer qualifiedThreshold;
    Integer rejectThreshold;
    Boolean autoRejectEnabled;
    String requiredTest;
    JobCategory category;
}
