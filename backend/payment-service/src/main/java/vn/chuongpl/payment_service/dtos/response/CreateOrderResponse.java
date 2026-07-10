package vn.chuongpl.payment_service.dtos.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreateOrderResponse {
    String orderId;
    Long orderCode;
    String paymentUrl;
    String qrCode;
}
