package vn.chuongpl.payment_service.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error", 500),
    UNAUTHENTICATED(4010, "Unauthenticated", 401),
    FORBIDDEN(4030, "Access denied", 403),
    INVALID_REQUEST(4000, "Invalid request", 400),
    PAYMENT_ORDER_NOT_FOUND(4040, "Payment order not found", 404),
    PAYMENT_ORDER_NOT_CANCELLABLE(4001, "Order cannot be cancelled in current status", 400),
    PAYMENT_ORDER_CREATION_FAILED(5001, "Failed to create payment order", 500),
    PAYMENT_GATEWAY_ERROR(5002, "Payment gateway error", 500),
    SERVICE_PACKAGE_NOT_FOUND(4041, "Service package not found", 404),
    ACTIVE_PACKAGE_STILL_VALID(4002, "Vui lòng sử dụng đến hết thời hạn của gói hiện tại.", 400);

    private final int code;
    private final String message;
    private final int httpStatus;
}
