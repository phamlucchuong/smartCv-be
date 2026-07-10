package vn.chuongpl.user_service.dtos.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
public class GoogleAuthRequest {
    @NotBlank(message = "GOOGLE_ID_TOKEN_REQUIRED")
    String idToken;
    String role;
}
