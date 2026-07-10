package vn.chuongpl.application_service.integration.notification;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ApplicationEventMessage implements Serializable {
    String applicationId;
    String candidateId;
    String candidateEmail;
    String recruiterId;
    String recruiterUserId;
    String jobId;
    String jobTitle;
    String newStatus;
    String rejectionReason;
    LocalDateTime occurredAt;
}
