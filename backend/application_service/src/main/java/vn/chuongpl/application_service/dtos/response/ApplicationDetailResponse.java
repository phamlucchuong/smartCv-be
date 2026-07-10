package vn.chuongpl.application_service.dtos.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.application_service.enums.AiScoringStatus;
import vn.chuongpl.application_service.enums.ApplicationStatus;

import java.util.List;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ApplicationDetailResponse {
    String id;
    String candidateId;
    String jobId;
    String recruiterId;
    String jobTitle;
    String companyName;
    ApplicationStatus status;
    String coverLetter;
    String cvUrl;
    String rejectionReason;
    String recruiterNotes;
    Integer aiScore;
    List<String> matchedSkills;
    List<String> missingSkills;
    AiScoringStatus aiStatus;
    LocalDateTime appliedAt;
    LocalDateTime updatedAt;
}
