package vn.chuongpl.user_service.dtos.message;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class OTPMessage implements Serializable {
    String target;
    String targetType;
    String otpType;
    Integer ttlMinutes;
}
