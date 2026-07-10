package vn.chuongpl.user_service.dtos.message;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiCreditExhaustedMessage {
    private String userId;
    private String userRole;
}
