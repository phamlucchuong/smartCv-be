package vn.chuongpl.user_service.dtos.message;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RecruiterPendingEventMessage implements Serializable {
    String recruiterId;
    String recruiterEmail;
    String companyName;
    List<String> adminUserIds;
    LocalDateTime occurredAt;
}
