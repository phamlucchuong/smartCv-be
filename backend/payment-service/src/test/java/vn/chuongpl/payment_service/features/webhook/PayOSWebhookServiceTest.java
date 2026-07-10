package vn.chuongpl.payment_service.features.webhook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.result.UpdateResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import vn.chuongpl.payment_service.enums.OrderStatus;
import vn.chuongpl.payment_service.features.order.PaymentOrder;
import vn.chuongpl.payment_service.features.order.PaymentOrderRepository;
import vn.chuongpl.payment_service.features.order.PaymentOrderService;
import vn.payos.PayOS;
import vn.payos.type.Webhook;
import vn.payos.type.WebhookData;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayOSWebhookServiceTest {

    @Mock PayOS payOS;
    @Mock PaymentOrderRepository paymentOrderRepository;
    @Mock PaymentOrderService paymentOrderService;
    @Mock MongoTemplate mongoTemplate;
    @Mock ObjectMapper objectMapper;

    @InjectMocks
    PayOSWebhookService payOSWebhookService;

    @Test
    void handleWebhook_invalidSignature_returnsWithoutProcessing() throws Exception {
        when(objectMapper.readValue(anyString(), eq(Webhook.class))).thenReturn(mock(Webhook.class));
        when(payOS.verifyPaymentWebhookData(any(Webhook.class))).thenThrow(new RuntimeException("bad signature"));

        payOSWebhookService.handleWebhook("{}");

        verifyNoInteractions(paymentOrderRepository);
    }

    @Test
    void handleWebhook_alreadyPaid_returnsIdempotent() throws Exception {
        WebhookData webhookData = mock(WebhookData.class);
        when(webhookData.getOrderCode()).thenReturn(123L);
        when(webhookData.getCode()).thenReturn("00");
        when(objectMapper.readValue(anyString(), eq(Webhook.class))).thenReturn(mock(Webhook.class));
        when(payOS.verifyPaymentWebhookData(any(Webhook.class))).thenReturn(webhookData);

        PaymentOrder order = PaymentOrder.builder()
                .id("order-1").orderCode(123L).status(OrderStatus.PAID).build();
        when(paymentOrderRepository.findByOrderCode(123L)).thenReturn(Optional.of(order));

        UpdateResult noopResult = mock(UpdateResult.class);
        when(noopResult.getModifiedCount()).thenReturn(0L);
        when(mongoTemplate.updateFirst(any(), any(), eq(PaymentOrder.class))).thenReturn(noopResult);

        payOSWebhookService.handleWebhook("{}");

        verify(paymentOrderService, never()).publishPaymentCompleted(any());
        verify(paymentOrderRepository, never()).save(any());
    }

    @Test
    void handleWebhook_successCode_transitionsToPaid_publishesEvent() throws Exception {
        WebhookData webhookData = mock(WebhookData.class);
        when(webhookData.getOrderCode()).thenReturn(456L);
        when(webhookData.getCode()).thenReturn("00");
        when(objectMapper.readValue(anyString(), eq(Webhook.class))).thenReturn(mock(Webhook.class));
        when(payOS.verifyPaymentWebhookData(any(Webhook.class))).thenReturn(webhookData);

        PaymentOrder order = PaymentOrder.builder()
                .id("order-2").orderCode(456L).status(OrderStatus.PENDING).build();
        when(paymentOrderRepository.findByOrderCode(456L)).thenReturn(Optional.of(order));

        UpdateResult updateResult = mock(UpdateResult.class);
        when(updateResult.getModifiedCount()).thenReturn(1L);
        when(mongoTemplate.updateFirst(any(), any(), eq(PaymentOrder.class))).thenReturn(updateResult);

        payOSWebhookService.handleWebhook("{}");

        verify(mongoTemplate).updateFirst(any(), any(), eq(PaymentOrder.class));
        verify(paymentOrderService).publishPaymentCompleted(any());
        verify(paymentOrderRepository, never()).save(any());
    }

    @Test
    void handleWebhook_failureCode_transitionsToFailed() throws Exception {
        WebhookData webhookData = mock(WebhookData.class);
        when(webhookData.getOrderCode()).thenReturn(789L);
        when(webhookData.getCode()).thenReturn("01");
        when(objectMapper.readValue(anyString(), eq(Webhook.class))).thenReturn(mock(Webhook.class));
        when(payOS.verifyPaymentWebhookData(any(Webhook.class))).thenReturn(webhookData);

        PaymentOrder order = PaymentOrder.builder()
                .id("order-3").orderCode(789L).status(OrderStatus.PENDING).build();
        when(paymentOrderRepository.findByOrderCode(789L)).thenReturn(Optional.of(order));

        UpdateResult updateResult = mock(UpdateResult.class);
        when(mongoTemplate.updateFirst(any(), any(), eq(PaymentOrder.class))).thenReturn(updateResult);

        payOSWebhookService.handleWebhook("{}");

        verify(mongoTemplate).updateFirst(any(), any(), eq(PaymentOrder.class));
        verify(paymentOrderService, never()).publishPaymentCompleted(any());
        verify(paymentOrderRepository, never()).save(any());
    }
}
