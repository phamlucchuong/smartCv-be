package vn.chuongpl.job_service.features.job;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class JobEventMessage {
    String jobId;
    String recruiterId;
    String recruiterEmail;
    String title;
    String company;
    String eventType;
    String moderationNote;
    LocalDateTime occurredAt;
}
