package vn.chuongpl.user_service.dtos.message;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RecruiterBillingEventMessage {
    private String recruiterId;
    private String recruiterUserId;
    private String recruiterEmail;
    private String companyName;
    private String eventType;
    private String dueAt;
    private String lockedAt;
    private String amount;
}
