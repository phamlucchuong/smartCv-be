package vn.chuongpl.payment_service.dtos;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
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
