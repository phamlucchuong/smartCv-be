package vn.chuongpl.user_service.dtos.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.Set;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserResponse {
    String id;
    String fullName;
    String email;
    String phone;
    String avatarUrl;
    Set<String> roles;
    boolean verified;
    boolean locked;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
