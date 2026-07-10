package vn.chuongpl.user_service.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.enums.ErrorCode;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {


    @ExceptionHandler(value = Exception.class)
    ResponseEntity<ApiResponse<?>> handlingRuntimeException(Exception exception) {
        log.error("Unhandled exception occurred", exception);
        ApiResponse<?> apiResponse = new ApiResponse<>();
        apiResponse.setOk(false);
        apiResponse.setCode(ErrorCode.UNCATEGORIZED_EXCEPTION.getCode());
        apiResponse.setMessage(ErrorCode.UNCATEGORIZED_EXCEPTION.getMessage());
        return ResponseEntity.badRequest().body(apiResponse);
    }

    @ExceptionHandler(value = AppException.class)
    ResponseEntity<ApiResponse<?>> handlingAppException(AppException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        ApiResponse<Object> apiResponse = new ApiResponse<>();
        apiResponse.setOk(false);
        apiResponse.setCode(errorCode.getCode());
        apiResponse.setMessage(errorCode.getMessage());
        apiResponse.setData(exception.getData());
        return ResponseEntity.badRequest().body(apiResponse);
    }

    // Nên bắt thêm lỗi bảo mật riêng để trả về 403 cho chuyên nghiệp
    @ExceptionHandler(value = AccessDeniedException.class)
    public ResponseEntity<ApiResponse<?>> handlingAccessDeniedException(AccessDeniedException exception) {
        log.error("Access denied exception", exception);
        ApiResponse<?> apiResponse = new ApiResponse<>();
        apiResponse.setOk(false);
        apiResponse.setCode(403);
        apiResponse.setMessage("Bạn không có quyền truy cập tài nguyên này");

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(apiResponse);
    }
}