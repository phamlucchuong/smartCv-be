package vn.chuongpl.user_service.dtos.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RegisterRequest {
    @NotBlank(message = "USER_NAME_INVALID")
    String fullname;
    @Email(message = "EMAIL_INVALID")
    String email;
    @Size(min = 8, message = "PASSWORD_INVALID")
    String password;
    @Pattern(regexp = "^(0|\\+84)(3|5|7|8|9)\\d{8}$", message = "PHONE_INVALID")
    String phone;
    String preferredVerification;
    @NotBlank(message = "ROLE_REQUIRED")
    String role;
    String companyName;
}
