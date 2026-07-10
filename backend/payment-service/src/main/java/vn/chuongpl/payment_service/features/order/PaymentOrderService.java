package vn.chuongpl.payment_service.features.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.payment_service.config.PayOSConfig;
import vn.chuongpl.payment_service.config.RabbitMQConfig;
import vn.chuongpl.payment_service.dtos.PageResponse;
import vn.chuongpl.payment_service.dtos.PaymentCompletedEvent;
import vn.chuongpl.payment_service.dtos.request.CreateOrderRequest;
import vn.chuongpl.payment_service.dtos.response.CreateOrderResponse;
import vn.chuongpl.payment_service.dtos.response.OrderResponse;
import vn.chuongpl.payment_service.enums.ErrorCode;
import vn.chuongpl.payment_service.enums.OrderStatus;
import vn.chuongpl.payment_service.exception.AppException;
import vn.payos.PayOS;
import vn.payos.type.CheckoutResponseData;
import vn.payos.type.ItemData;
import vn.payos.type.PaymentData;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class PaymentOrderService {

    PaymentOrderRepository paymentOrderRepository;
    PaymentOrderMapper paymentOrderMapper;
    PayOS payOS;
    PayOSConfig payOSConfig;
    RabbitTemplate rabbitTemplate;
    RestTemplate restTemplate;
    ObjectMapper objectMapper;
    MongoTemplate mongoTemplate;

    @lombok.experimental.NonFinal
    @Value("${integration.user-service-url}")
    String userServiceUrl;

    @lombok.experimental.NonFinal
    @Value("${app.gateway.internal-secret}")
    String gatewayInternalSecret;

    public CreateOrderResponse createOrder(CreateOrderRequest request) {
        String userId = getCurrentUserId();
        String userRole = getCurrentUserRole();
        boolean freePackage = "free".equalsIgnoreCase(request.getPackageId());
        boolean platformFeeOrder = "fee".equalsIgnoreCase(request.getPackageId());

        // Guard: check if user already has a valid premium package
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Gateway-Secret", gatewayInternalSecret);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            String activePackageId = null;
            LocalDateTime packageExpiresAt = null;

            if ("CANDIDATE".equalsIgnoreCase(userRole)) {
                ResponseEntity<Map> response = restTemplate.exchange(
                        userServiceUrl + "/api/internal/candidates/by-user/" + userId,
                        HttpMethod.GET,
                        entity,
                        Map.class
                );
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
                    if (data != null) {
                        activePackageId = (String) data.get("activePackageId");
                        if (data.get("packageExpiresAt") != null) {
                            packageExpiresAt = LocalDateTime.parse(data.get("packageExpiresAt").toString());
                        }
                    }
                }
            } else if ("RECRUITER".equalsIgnoreCase(userRole)) {
                ResponseEntity<Map> response = restTemplate.exchange(
                        userServiceUrl + "/api/internal/recruiters/by-user/" + userId,
                        HttpMethod.GET,
                        entity,
                        Map.class
                );
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
                    if (data != null) {
                        activePackageId = (String) data.get("activePackageId");
                        if (data.get("packageExpiresAt") != null) {
                            packageExpiresAt = LocalDateTime.parse(data.get("packageExpiresAt").toString());
                        }
                    }
                }
            }

            if (!freePackage && !platformFeeOrder && activePackageId != null && !activePackageId.isBlank() && !"free".equalsIgnoreCase(activePackageId)) {
                if (packageExpiresAt != null && packageExpiresAt.isAfter(LocalDateTime.now())) {
                    throw new AppException(ErrorCode.ACTIVE_PACKAGE_STILL_VALID);
                }
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Payment] Failed to verify active package for user {}: {}", userId, e.getMessage());
        }

        Map<String, Object> packageData = fetchServicePackage(request.getPackageId());

        // Duplicate check
        var existing = paymentOrderRepository.findByUserIdAndPackageIdAndStatus(userId, request.getPackageId(), OrderStatus.PENDING);
        if (existing.isPresent()) {
            PaymentOrder existingOrder = existing.get();
            if (existingOrder.getCreatedAt().isAfter(LocalDateTime.now().minusMinutes(15))) {
                return paymentOrderMapper.toCreateOrderResponse(existingOrder);
            }
            // Stale — cancel on PayOS and locally
            try {
                payOS.cancelPaymentLink(existingOrder.getOrderCode(), null);
            } catch (Exception e) {
                log.warn("[Payment] Failed to cancel stale PayOS link orderCode={}: {}", existingOrder.getOrderCode(), e.getMessage());
            }
            existingOrder.setStatus(OrderStatus.CANCELLED);
            existingOrder.setUpdatedAt(LocalDateTime.now());
            paymentOrderRepository.save(existingOrder);
        }

        String packageName = (String) packageData.get("name");
        Long price = packageData.get("price") instanceof Number n ? n.longValue() : 0L;
        Integer aiCredits = packageData.get("aiCredits") instanceof Number n ? n.intValue() : null;
        Integer jobLimit = packageData.get("jobLimit") instanceof Number n ? n.intValue() : null;
        Integer cvLimit = packageData.get("cvLimit") instanceof Number n ? n.intValue() : null;
        Integer durationDays = packageData.get("durationDays") instanceof Number n ? n.intValue() : null;

        if (freePackage) {
            return createFreePackageOrder(userId, userRole, request.getPackageId(), packageName,
                    aiCredits, jobLimit, cvLimit, durationDays);
        }

        String displayName = packageName;
        if ("plus".equalsIgnoreCase(request.getPackageId())) {
            displayName = "Smart CV Plus";
        } else if ("pro".equalsIgnoreCase(request.getPackageId())) {
            displayName = "Smart CV Pro";
        }

        String description = displayName;
        if (description.length() > 25) description = description.substring(0, 25);

        for (int attempt = 0; attempt < 3; attempt++) {
            long orderCode = generateOrderCode();
            try {
                String returnUrl = payOSConfig.getReturnUrl();
                String cancelUrl = payOSConfig.getCancelUrl();
                if (userRole != null) {
                    returnUrl += (returnUrl.contains("?") ? "&" : "?") + "role=" + userRole;
                    cancelUrl += (cancelUrl.contains("?") ? "&" : "?") + "role=" + userRole;
                }

                PaymentData paymentData = PaymentData.builder()
                        .orderCode(orderCode)
                        .amount(Math.toIntExact(price))
                        .description(description)
                        .returnUrl(returnUrl)
                        .cancelUrl(cancelUrl)
                        .item(ItemData.builder()
                                .name(displayName)
                                .price(Math.toIntExact(price))
                                .quantity(1)
                                .build())
                        .build();

                CheckoutResponseData responseData = createPaymentLinkDirect(paymentData);

                PaymentOrder order = PaymentOrder.builder()
                        .id(UUID.randomUUID().toString())
                        .orderCode(orderCode)
                        .userId(userId)
                        .userRole(userRole)
                        .packageId(request.getPackageId())
                        .packageName(packageName)
                        .packageAiCredits(aiCredits)
                        .packageJobLimit(jobLimit)
                        .packageCvLimit(cvLimit)
                        .packageDurationDays(durationDays)
                        .amount(price)
                        .status(OrderStatus.PENDING)
                        .paymentUrl(responseData.getCheckoutUrl())
                        .qrCode(responseData.getQrCode())
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();

                PaymentOrder saved = paymentOrderRepository.save(order);
                return paymentOrderMapper.toCreateOrderResponse(saved);

            } catch (DuplicateKeyException e) {
                log.warn("[Payment] OrderCode collision attempt {}/3", attempt + 1);
                if (attempt == 2) throw new AppException(ErrorCode.PAYMENT_ORDER_CREATION_FAILED);
            } catch (Exception e) {
                log.error("[Payment] PayOS createPaymentLink failed: {}", e.getMessage());
                throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);
            }
        }
        throw new AppException(ErrorCode.PAYMENT_ORDER_CREATION_FAILED);
    }

    private CreateOrderResponse createFreePackageOrder(String userId,
                                                       String userRole,
                                                       String packageId,
                                                       String packageName,
                                                       Integer aiCredits,
                                                       Integer jobLimit,
                                                       Integer cvLimit,
                                                       Integer durationDays) {
        long orderCode = generateOrderCode();
        LocalDateTime now = LocalDateTime.now();

        PaymentOrder order = PaymentOrder.builder()
                .id(UUID.randomUUID().toString())
                .orderCode(orderCode)
                .userId(userId)
                .userRole(userRole)
                .packageId(packageId)
                .packageName(packageName)
                .packageAiCredits(aiCredits)
                .packageJobLimit(jobLimit)
                .packageCvLimit(cvLimit)
                .packageDurationDays(durationDays)
                .amount(0L)
                .status(OrderStatus.PAID)
                .paymentUrl(null)
                .qrCode(null)
                .createdAt(now)
                .updatedAt(now)
                .paidAt(now)
                .build();

        PaymentOrder saved = paymentOrderRepository.save(order);
        publishPaymentCompleted(saved);
        return paymentOrderMapper.toCreateOrderResponse(saved);
    }

    public PageResponse<OrderResponse> getOrders(String userId, int page, int size) {
        Page<PaymentOrder> orderPage = paymentOrderRepository.findByUserId(
                userId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<OrderResponse> items = orderPage.getContent().stream()
                .map(this::syncOrderWithPayOS)
                .map(order -> {
                    OrderResponse resp = paymentOrderMapper.toOrderResponse(order);
                    resp.setPaymentType(determinePaymentType(order));
                    return resp;
                })
                .toList();
        return PageResponse.<OrderResponse>builder()
                .content(items)
                .totalElements(orderPage.getTotalElements())
                .page(page)
                .size(size)
                .totalPages(orderPage.getTotalPages())
                .build();
    }

    public OrderResponse getOrderById(String orderId, String userId) {
        PaymentOrder order = paymentOrderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_ORDER_NOT_FOUND));
        order = syncOrderWithPayOS(order);
        OrderResponse resp = paymentOrderMapper.toOrderResponse(order);
        resp.setPaymentType(determinePaymentType(order));
        return resp;
    }

    public PageResponse<OrderResponse> getAllOrders(int page, int size) {
        Page<PaymentOrder> orderPage = paymentOrderRepository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        List<OrderResponse> items = orderPage.getContent().stream()
                .map(this::syncOrderWithPayOS)
                .map(order -> {
                    OrderResponse resp = paymentOrderMapper.toOrderResponse(order);
                    resp.setPaymentType(determinePaymentType(order));
                    return resp;
                })
                .toList();
        return PageResponse.<OrderResponse>builder()
                .content(items)
                .totalElements(orderPage.getTotalElements())
                .page(page)
                .size(size)
                .totalPages(orderPage.getTotalPages())
                .build();
    }

    private String determinePaymentType(PaymentOrder order) {
        if ("CANDIDATE".equalsIgnoreCase(order.getUserRole())) {
            return "Gói sử dụng";
        } else if ("RECRUITER".equalsIgnoreCase(order.getUserRole())) {
            if (order.getPackageId() != null &&
                    (order.getPackageId().toLowerCase().contains("fee") ||
                            (order.getPackageName() != null && order.getPackageName().toLowerCase().contains("phí")))) {
                return "Phí sàn";
            }
            return "Gói sử dụng";
        }
        return "Khác";
    }

    private PaymentOrder syncOrderWithPayOS(PaymentOrder order) {
        if (order.getStatus() != OrderStatus.PENDING) {
            return order;
        }
        try {
            vn.payos.type.PaymentLinkData payosInfo = payOS.getPaymentLinkInformation(order.getOrderCode());
            String payosStatus = payosInfo.getStatus();
            log.info("[Payment] Syncing orderCode={} status from PayOS: {}", order.getOrderCode(), payosStatus);

            if ("PAID".equalsIgnoreCase(payosStatus)) {
                order.setStatus(OrderStatus.PAID);
                order.setPaidAt(LocalDateTime.now());
                order.setUpdatedAt(LocalDateTime.now());
                PaymentOrder saved = paymentOrderRepository.save(order);
                publishPaymentCompleted(saved);
                return saved;
            } else if ("CANCELLED".equalsIgnoreCase(payosStatus)) {
                order.setStatus(OrderStatus.CANCELLED);
                order.setUpdatedAt(LocalDateTime.now());
                return paymentOrderRepository.save(order);
            } else if ("EXPIRED".equalsIgnoreCase(payosStatus)) {
                order.setStatus(OrderStatus.FAILED);
                order.setUpdatedAt(LocalDateTime.now());
                return paymentOrderRepository.save(order);
            }
        } catch (Exception e) {
            log.warn("[Payment] Failed to sync orderCode={} with PayOS: {}", order.getOrderCode(), e.getMessage());
        }
        return order;
    }

    public void cancelOrderByCode(Long orderCode, String userId) {
        PaymentOrder order = paymentOrderRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_ORDER_NOT_FOUND));
        if (!order.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (order.getStatus() != OrderStatus.PENDING) {
            return; // idempotent — already cancelled/paid
        }
        try {
            payOS.cancelPaymentLink(orderCode, "User cancelled via return URL");
        } catch (Exception e) {
            log.warn("[Payment] PayOS cancel failed orderCode={}: {}", orderCode, e.getMessage());
        }
        Query query = Query.query(Criteria.where("order_code").is(orderCode).and("status").is(OrderStatus.PENDING));
        Update update = new Update()
                .set("status", OrderStatus.CANCELLED)
                .set("updated_at", LocalDateTime.now());
        mongoTemplate.updateFirst(query, update, PaymentOrder.class);
    }

    public void cancelOrder(String orderId, String userId) {
        PaymentOrder order = paymentOrderRepository.findById(orderId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_ORDER_NOT_FOUND));

        if (!order.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new AppException(ErrorCode.PAYMENT_ORDER_NOT_CANCELLABLE);
        }

        try {
            payOS.cancelPaymentLink(order.getOrderCode(), null);
        } catch (Exception e) {
            log.warn("[Payment] Failed to cancel PayOS link orderCode={}: {}", order.getOrderCode(), e.getMessage());
        }

        // Atomic transition: only set CANCELLED if still PENDING (guards against concurrent PAID webhook)
        Query query = Query.query(Criteria.where("id").is(orderId).and("status").is(OrderStatus.PENDING));
        Update update = new Update()
                .set("status", OrderStatus.CANCELLED)
                .set("updated_at", LocalDateTime.now());
        long modified = mongoTemplate.updateFirst(query, update, PaymentOrder.class).getModifiedCount();
        if (modified == 0) {
            log.info("[Payment] Order {} status changed before cancel could apply, ignoring", orderId);
        }
    }

    public void publishPaymentCompleted(PaymentOrder order) {
        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .userId(order.getUserId())
                .userRole(order.getUserRole())
                .packageId(order.getPackageId())
                .packageName(order.getPackageName())
                .packageAiCredits(order.getPackageAiCredits())
                .packageJobLimit(order.getPackageJobLimit())
                .packageCvLimit(order.getPackageCvLimit())
                .packageDurationDays(order.getPackageDurationDays())
                .orderId(order.getId())
                .paidAt(order.getPaidAt())
                .build();
        rabbitTemplate.convertAndSend(RabbitMQConfig.PAYMENT_EXCHANGE, RabbitMQConfig.PAYMENT_COMPLETED_KEY, event);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchServicePackage(String packageId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Gateway-Secret", gatewayInternalSecret);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    userServiceUrl + "/api/internal/packages/" + packageId,
                    HttpMethod.GET,
                    entity,
                    Map.class
            );
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new AppException(ErrorCode.SERVICE_PACKAGE_NOT_FOUND);
            }
            Object data = response.getBody().get("data");
            if (data instanceof Map<?, ?> dataMap) {
                return (Map<String, Object>) dataMap;
            }
            throw new AppException(ErrorCode.SERVICE_PACKAGE_NOT_FOUND);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Payment] Failed to fetch service package {}: {}", packageId, e.getMessage());
            throw new AppException(ErrorCode.SERVICE_PACKAGE_NOT_FOUND);
        }
    }

    // Bypasses SDK's response signature verification which is broken in SDK 1.0.3
    // when PayOS adds new fields (like expiredAt) that cause null/non-null mismatches.
    // We still sign the request correctly; we just skip verifying the response signature.
    @SuppressWarnings("unchecked")
    private CheckoutResponseData createPaymentLinkDirect(PaymentData paymentData) throws Exception {
        String dataStr = "amount=" + paymentData.getAmount() +
                "&cancelUrl=" + paymentData.getCancelUrl() +
                "&description=" + paymentData.getDescription() +
                "&orderCode=" + paymentData.getOrderCode() +
                "&returnUrl=" + paymentData.getReturnUrl();
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(payOSConfig.getChecksumKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] rawHmac = mac.doFinal(dataStr.getBytes(StandardCharsets.UTF_8));
        StringBuilder sig = new StringBuilder();
        for (byte b : rawHmac) sig.append(String.format("%02x", b));
        paymentData.setSignature(sig.toString());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-client-id", payOSConfig.getClientId());
        headers.set("x-api-key", payOSConfig.getApiKey());

        String body = objectMapper.writeValueAsString(paymentData);
        ResponseEntity<Map> response = restTemplate.exchange(
                "https://api-merchant.payos.vn/v2/payment-requests",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                Map.class
        );

        Map<String, Object> responseBody = response.getBody();
        if (responseBody == null || !"00".equals(responseBody.get("code"))) {
            String desc = responseBody != null ? String.valueOf(responseBody.get("desc")) : "null";
            log.error("[Payment] PayOS API error: {}", desc);
            throw new Exception("PayOS API error: " + desc);
        }

        Map<String, Object> data = (Map<String, Object>) responseBody.get("data");
        return CheckoutResponseData.builder()
                .bin((String) data.get("bin"))
                .accountNumber((String) data.get("accountNumber"))
                .accountName((String) data.get("accountName"))
                .amount(data.get("amount") instanceof Number n ? n.intValue() : null)
                .description((String) data.get("description"))
                .orderCode(data.get("orderCode") instanceof Number n ? n.longValue() : null)
                .currency((String) data.get("currency"))
                .paymentLinkId((String) data.get("paymentLinkId"))
                .status((String) data.get("status"))
                .expiredAt(data.get("expiredAt") instanceof Number n ? n.longValue() : null)
                .checkoutUrl((String) data.get("checkoutUrl"))
                .qrCode((String) data.get("qrCode"))
                .build();
    }

    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return principal.toString();
    }

    private String getCurrentUserRole() {
        return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
            .findFirst()
            .map(a -> a.getAuthority().replace("ROLE_", ""))
            .orElse("CANDIDATE");
    }

    private long generateOrderCode() {
        return (System.currentTimeMillis() % 1_000_000_000_000L) * 1000
                + ThreadLocalRandom.current().nextInt(1_000_000);
    }
}
