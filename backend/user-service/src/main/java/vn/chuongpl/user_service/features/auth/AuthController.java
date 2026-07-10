package vn.chuongpl.user_service.features.auth;

import com.nimbusds.jose.JOSEException;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.request.*;
import vn.chuongpl.user_service.dtos.response.AuthResponse;
import vn.chuongpl.user_service.dtos.response.IntrospectResponse;
import vn.chuongpl.user_service.dtos.response.UserResponse;

import java.text.ParseException;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthController {
    AuthService authService;

    @PostMapping("/register")
    public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.<UserResponse>builder()
                .message("Please verify your account with the OTP sent to your " +
                        ("SMS".equalsIgnoreCase(request.getPreferredVerification()) ? "phone" : "email"))
                .data(authService.register(request))
                .build();
    }

    @PostMapping("/verify-registration")
    public ApiResponse<AuthResponse> verifyRegistration(@Valid @RequestBody VerifyRegistrationRequest request) {
        return ApiResponse.<AuthResponse>builder()
                .message("Account verified successfully")
                .data(authService.verifyRegistration(request))
                .build();
    }

    @PostMapping("/resend-otp")
    public ApiResponse<Void> resendOtp(@Valid @RequestBody ResendOtpRequest request) {
        authService.resendOtp(request);
        return ApiResponse.<Void>builder().message("OTP resent successfully").build();
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ApiResponse.<Void>builder().message("Password reset OTP sent").build();
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.<Void>builder().message("Password reset successfully").build();
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> authenticated(@RequestBody AuthRequest request) {
        Map<String, String> tokens = authService.authenticated(request);
        return ApiResponse.<AuthResponse>builder()
                .message("Login successful")
                .data(AuthResponse.builder()
                        .token(tokens.get("accessToken"))
                        .refreshToken(tokens.get("refreshToken"))
                        .authenticated(true)
                        .build())
                .build();
    }

    @PostMapping("/google")
    public ApiResponse<AuthResponse> authenticateWithGoogle(@Valid @RequestBody GoogleAuthRequest request) {
        return ApiResponse.<AuthResponse>builder()
                .message("Google sign-in successful")
                .data(authService.authenticateWithGoogle(request))
                .build();
    }

    @PostMapping("/introspect")
    public ApiResponse<IntrospectResponse> introspect(@RequestBody IntrospectRequest request)
            throws ParseException, JOSEException {
        return ApiResponse.<IntrospectResponse>builder().data(authService.introspect(request)).build();
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader(HttpHeaders.AUTHORIZATION) String authHeader)
            throws ParseException, JOSEException {
        String token = authHeader.replace("Bearer ", "").strip();
        authService.logout(token);
        return ApiResponse.<Void>builder().message("Logout successfully").build();
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refreshToken(@RequestBody RefreshTokenRequest request)
            throws ParseException, JOSEException {
        return ApiResponse.<AuthResponse>builder().data(authService.refreshToken(request.getRefreshToken())).build();
    }
}
