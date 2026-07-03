package vn.chuongpl.user_service.dtos.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.chuongpl.user_service.enums.RecruiterStatus;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecruiterProfileResponse {
    String recruiterId;
    String userId;
    RecruiterStatus status;
    int quotaJobPost;
    int quotaCvViews;
    String activePackageId;
    LocalDateTime packageExpiresAt;
    Integer aiCreditsTotal;
    Integer aiCreditsUsed;
    Integer aiCreditsRemaining;
    LocalDateTime platformFeeDueAt;
    LocalDateTime platformFeeLastPaidAt;
    LocalDateTime platformFeeReminderSentAt;
    LocalDateTime platformFeeOverdueSentAt;
    LocalDateTime platformFeeLockedAt;
}
