package vn.chuongpl.user_service.dtos.message;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.user_service.enums.RecruiterStatus;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RecruiterStatusEventMessage implements Serializable {
    String recruiterId;
    String recruiterEmail;
    String contactEmail;
    String companyName;
    RecruiterStatus status;
    String rejectionNote;
    LocalDateTime occurredAt;
}
