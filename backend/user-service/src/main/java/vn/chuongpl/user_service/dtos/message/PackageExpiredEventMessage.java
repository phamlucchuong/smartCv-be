package vn.chuongpl.user_service.dtos.message;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PackageExpiredEventMessage {
    private String userId;
    private String userEmail;
    private String userRole;
    private String packageId;
    private String expiredAt;
}
