package vn.chuongpl.payment_service.features.order;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.payment_service.dtos.ApiResponse;
import vn.chuongpl.payment_service.dtos.PageResponse;
import vn.chuongpl.payment_service.dtos.request.CreateOrderRequest;
import vn.chuongpl.payment_service.dtos.response.CreateOrderResponse;
import vn.chuongpl.payment_service.dtos.response.OrderResponse;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class PaymentOrderController {

    PaymentOrderService paymentOrderService;

    @PostMapping
    public ApiResponse<CreateOrderResponse> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        return ApiResponse.<CreateOrderResponse>builder()
                .message("Order created")
                .data(paymentOrderService.createOrder(request))
                .build();
    }

    @GetMapping
    public ApiResponse<PageResponse<OrderResponse>> getOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
        return ApiResponse.<PageResponse<OrderResponse>>builder()
                .data(paymentOrderService.getOrders(userId, page, size))
                .build();
    }

    @GetMapping("/admin")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<PageResponse<OrderResponse>> getAllOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.<PageResponse<OrderResponse>>builder()
                .data(paymentOrderService.getAllOrders(page, size))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<OrderResponse> getOrderById(@PathVariable String id) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
        return ApiResponse.<OrderResponse>builder()
                .data(paymentOrderService.getOrderById(id, userId))
                .build();
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<Void> cancelOrder(@PathVariable String id) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
        paymentOrderService.cancelOrder(id, userId);
        return ApiResponse.<Void>builder().message("Order cancelled").build();
    }

    @PostMapping("/cancel-by-code")
    public ApiResponse<Void> cancelOrderByCode(@RequestParam Long orderCode) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
        paymentOrderService.cancelOrderByCode(orderCode, userId);
        return ApiResponse.<Void>builder().message("Order cancelled").build();
    }
}
