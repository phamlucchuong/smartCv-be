package vn.chuongpl.application_service.features.assessment;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AssessmentEventMessage {
    String attemptId;
    String assessmentId;
    String assessmentTitle;
    String candidateId;
    String recruiterId;
    String recruiterUserId;
    Double score;
    String result;
    boolean overtime;
    LocalDateTime occurredAt;
}
