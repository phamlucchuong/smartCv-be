package vn.chuongpl.application_service.dtos.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.application_service.enums.AttemptStatus;
import vn.chuongpl.application_service.enums.AttemptResult;
import vn.chuongpl.application_service.features.assessment.AttemptAnswer;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AttemptStateResponse {
    String attemptId;
    String assessmentId;
    AttemptStatus status;
    List<AttemptAnswer> answers;
    LocalDateTime startedAt;
    Double score;
    Integer correctAnswers;
    Integer totalQuestions;
    AttemptResult result;
}
