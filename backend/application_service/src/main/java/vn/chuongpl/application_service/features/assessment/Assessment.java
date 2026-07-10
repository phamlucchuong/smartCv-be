package vn.chuongpl.application_service.features.assessment;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.mapping.MongoId;
import vn.chuongpl.application_service.enums.AssessmentStatus;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "assessments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Assessment {
    @MongoId(FieldType.STRING)
    String id;

    @Field("job_id")
    String jobId;

    @Field("recruiter_id")
    String recruiterId;

    @Field("candidate_id")
    String candidateId;

    String title;
    String description;

    @Builder.Default
    List<Question> questions = new ArrayList<>();

    @Field("time_limit_minutes")
    int timeLimitMinutes;

    @Builder.Default
    AssessmentStatus status = AssessmentStatus.DRAFT;

    @Field("created_at")
    LocalDateTime createdAt;
}
