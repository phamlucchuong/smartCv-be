package vn.chuongpl.application_service.integration.job;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class JobResponse {
    String id;
    String recruiterId;
    String visibilityStatus;
    String moderationStatus;
    String title;
    String company;
    String location;
    Double salaryMin;
    Double salaryMax;
    java.util.List<String> skills;
    String jobType;
}
