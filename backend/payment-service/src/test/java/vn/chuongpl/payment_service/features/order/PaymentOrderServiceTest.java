package vn.chuongpl.payment_service.features.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.result.UpdateResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.payment_service.config.PayOSConfig;
import vn.chuongpl.payment_service.dtos.request.CreateOrderRequest;
import vn.chuongpl.payment_service.dtos.response.CreateOrderResponse;
import vn.chuongpl.payment_service.enums.ErrorCode;
import vn.chuongpl.payment_service.enums.OrderStatus;
import vn.chuongpl.payment_service.exception.AppException;
import vn.payos.PayOS;
import vn.payos.type.CheckoutResponseData;
import vn.payos.type.PaymentData;

import static org.mockito.Mockito.mock;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentOrderServiceTest {

    @Mock PaymentOrderRepository paymentOrderRepository;
    @Mock PaymentOrderMapper paymentOrderMapper;
    @Mock PayOS payOS;
    @Mock PayOSConfig payOSConfig;
    @Mock RabbitTemplate rabbitTemplate;
    @Mock RestTemplate restTemplate;
    @Mock ObjectMapper objectMapper;
    @Mock MongoTemplate mongoTemplate;

    @InjectMocks
    PaymentOrderService paymentOrderService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(paymentOrderService, "userServiceUrl", "http://localhost:8081/user");
        ReflectionTestUtils.setField(paymentOrderService, "gatewayInternalSecret", "changeme");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("user-1", null,
                        List.of(new SimpleGrantedAuthority("ROLE_RECRUITER")))
        );

        lenient().when(payOSConfig.getReturnUrl()).thenReturn("http://localhost:3000/success");
        lenient().when(payOSConfig.getCancelUrl()).thenReturn("http://localhost:3000/cancel");
        lenient().when(payOSConfig.getChecksumKey()).thenReturn("test-checksum-key");
        lenient().when(payOSConfig.getClientId()).thenReturn("test-client-id");
        lenient().when(payOSConfig.getApiKey()).thenReturn("test-api-key");
    }

    @Test
    void createOrder_newOrder_success() throws Exception {
        // Arrange
        when(restTemplate.exchange(contains("packages"), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", Map.of(
                        "name", "Pro", "price", 20000, "aiCredits", 30,
                        "jobLimit", 15, "cvLimit", -1, "durationDays", 30))));

        when(paymentOrderRepository.findByUserIdAndPackageIdAndStatus(any(), any(), any()))
                .thenReturn(Optional.empty());

        Map<String, Object> payosData = new HashMap<>();
        payosData.put("bin", "970422"); payosData.put("accountNumber", "1234");
        payosData.put("accountName", "Test"); payosData.put("amount", 20000);
        payosData.put("description", "Pro"); payosData.put("orderCode", 123L);
        payosData.put("currency", "VND"); payosData.put("paymentLinkId", "link-1");
        payosData.put("status", "PENDING"); payosData.put("checkoutUrl", "https://pay.payos.vn/abc");
        payosData.put("qrCode", "qr-data");
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(restTemplate.exchange(contains("payment-requests"), eq(HttpMethod.POST), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("code", "00", "data", payosData)));

        PaymentOrder savedOrder = PaymentOrder.builder()
                .id("order-1").orderCode(123L).paymentUrl("https://pay.payos.vn/abc").qrCode("qr-data")
                .status(OrderStatus.PENDING).build();
        when(paymentOrderRepository.save(any())).thenReturn(savedOrder);

        CreateOrderResponse expectedResponse = CreateOrderResponse.builder()
                .orderId("order-1").orderCode(123L).paymentUrl("https://pay.payos.vn/abc").qrCode("qr-data").build();
        when(paymentOrderMapper.toCreateOrderResponse(savedOrder)).thenReturn(expectedResponse);

        // Act
        CreateOrderResponse response = paymentOrderService.createOrder(new CreateOrderRequest("pro"));

        // Assert
        assertThat(response.getPaymentUrl()).isEqualTo("https://pay.payos.vn/abc");
        verify(paymentOrderRepository).save(any());
    }

    @Test
    void createOrder_existingFreshPendingOrder_returnsExisting() throws Exception {
        // Arrange
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", Map.of(
                        "name", "Pro", "price", 20000, "aiCredits", 30, "jobLimit", 15, "cvLimit", -1))));

        PaymentOrder existingOrder = PaymentOrder.builder()
                .id("existing-order").orderCode(999L).status(OrderStatus.PENDING)
                .paymentUrl("https://pay.payos.vn/existing")
                .createdAt(LocalDateTime.now().minusMinutes(5))
                .build();
        when(paymentOrderRepository.findByUserIdAndPackageIdAndStatus(any(), any(), any()))
                .thenReturn(Optional.of(existingOrder));

        CreateOrderResponse existingResponse = CreateOrderResponse.builder()
                .orderId("existing-order").paymentUrl("https://pay.payos.vn/existing").build();
        when(paymentOrderMapper.toCreateOrderResponse(existingOrder)).thenReturn(existingResponse);

        // Act
        CreateOrderResponse response = paymentOrderService.createOrder(new CreateOrderRequest("pro"));

        // Assert
        assertThat(response.getOrderId()).isEqualTo("existing-order");
        verify(restTemplate, never()).exchange(contains("payment-requests"), eq(HttpMethod.POST), any(), eq(Map.class));
    }

    @Test
    void createOrder_existingStalePendingOrder_cancelsAndCreatesNew() throws Exception {
        // Arrange
        when(restTemplate.exchange(contains("packages"), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("data", Map.of(
                        "name", "Pro", "price", 20000, "aiCredits", 30, "jobLimit", 15, "cvLimit", -1))));

        PaymentOrder staleOrder = PaymentOrder.builder()
                .id("stale-order").orderCode(888L).status(OrderStatus.PENDING)
                .createdAt(LocalDateTime.now().minusMinutes(20))
                .build();
        when(paymentOrderRepository.findByUserIdAndPackageIdAndStatus(any(), any(), any()))
                .thenReturn(Optional.of(staleOrder));

        Map<String, Object> payosData2 = new HashMap<>();
        payosData2.put("bin", "970422"); payosData2.put("accountNumber", "1234");
        payosData2.put("accountName", "Test"); payosData2.put("amount", 20000);
        payosData2.put("description", "Pro"); payosData2.put("orderCode", 777L);
        payosData2.put("currency", "VND"); payosData2.put("paymentLinkId", "link-2");
        payosData2.put("status", "PENDING"); payosData2.put("checkoutUrl", "https://pay.payos.vn/new");
        payosData2.put("qrCode", "new-qr");
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(restTemplate.exchange(contains("payment-requests"), eq(HttpMethod.POST), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("code", "00", "data", payosData2)));

        PaymentOrder newOrder = PaymentOrder.builder().id("new-order").orderCode(777L)
                .paymentUrl("https://pay.payos.vn/new").status(OrderStatus.PENDING).build();
        when(paymentOrderRepository.save(any())).thenReturn(newOrder);

        CreateOrderResponse newResponse = CreateOrderResponse.builder()
                .orderId("new-order").paymentUrl("https://pay.payos.vn/new").build();
        when(paymentOrderMapper.toCreateOrderResponse(newOrder)).thenReturn(newResponse);

        // Act
        CreateOrderResponse response = paymentOrderService.createOrder(new CreateOrderRequest("pro"));

        // Assert
        assertThat(response.getOrderId()).isEqualTo("new-order");
        verify(payOS).cancelPaymentLink(eq(888L), isNull());
        verify(restTemplate).exchange(contains("payment-requests"), eq(HttpMethod.POST), any(), eq(Map.class));
    }

    @Test
    void cancelOrder_notOwner_throwsForbidden() {
        PaymentOrder order = PaymentOrder.builder()
                .id("order-1").userId("other-user").status(OrderStatus.PENDING).build();
        when(paymentOrderRepository.findById("order-1")).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> paymentOrderService.cancelOrder("order-1", "user-1"))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    void cancelOrder_notPending_throwsNotCancellable() {
        PaymentOrder order = PaymentOrder.builder()
                .id("order-1").userId("user-1").status(OrderStatus.PAID).build();
        when(paymentOrderRepository.findById("order-1")).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> paymentOrderService.cancelOrder("order-1", "user-1"))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.PAYMENT_ORDER_NOT_CANCELLABLE));
    }

    @Test
    void cancelOrder_success() throws Exception {
        PaymentOrder order = PaymentOrder.builder()
                .id("order-1").userId("user-1").orderCode(555L).status(OrderStatus.PENDING).build();
        when(paymentOrderRepository.findById("order-1")).thenReturn(Optional.of(order));

        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        when(mongoTemplate.updateFirst(any(), any(), eq(PaymentOrder.class))).thenReturn(updateResult);

        paymentOrderService.cancelOrder("order-1", "user-1");

        verify(payOS).cancelPaymentLink(eq(555L), isNull());
        verify(mongoTemplate).updateFirst(any(), any(), eq(PaymentOrder.class));
        verify(paymentOrderRepository, never()).save(any());
    }
}
