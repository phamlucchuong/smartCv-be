package vn.chuongpl.user_service.dtos.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.user_service.enums.RecruiterStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RecruiterStatusRequest {
    @NotNull
    RecruiterStatus status;
    String rejectionNote;
    Integer quotaJobPost;
    Integer quotaCvViews;
}
