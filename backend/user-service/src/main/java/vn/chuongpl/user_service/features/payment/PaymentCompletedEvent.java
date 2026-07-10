package vn.chuongpl.user_service.features.payment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentCompletedEvent {
    String userId;
    String userRole;
    String packageId;
    String packageName;
    Integer packageAiCredits;
    Integer packageJobLimit;
    Integer packageCvLimit;
    Integer packageDurationDays;
    String orderId;
    LocalDateTime paidAt;
}
