package vn.chuongpl.application_service.features.assessment;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.mapping.MongoId;
import vn.chuongpl.application_service.enums.AttemptResult;
import vn.chuongpl.application_service.enums.AttemptStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "assessment_attempts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AssessmentAttempt {
    @MongoId(FieldType.STRING)
    String id;

    @Field("assessment_id")
    String assessmentId;

    @Field("candidate_id")
    String candidateId;

    @Field("application_id")
    String applicationId;

    @Builder.Default
    AttemptStatus status = AttemptStatus.IN_PROGRESS;

    @Builder.Default
    List<AttemptAnswer> answers = new ArrayList<>();

    @Field("started_at")
    LocalDateTime startedAt;

    @Field("submitted_at")
    LocalDateTime submittedAt;

    Double score;

    AttemptResult result;
}
