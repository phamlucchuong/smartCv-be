package vn.chuongpl.application_service.dtos.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.application_service.enums.AttemptResult;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AssessmentResultResponse {
    String attemptId;
    Double score;
    Integer correctAnswers;
    Integer totalQuestions;
    AttemptResult result;
    LocalDateTime submittedAt;
}
