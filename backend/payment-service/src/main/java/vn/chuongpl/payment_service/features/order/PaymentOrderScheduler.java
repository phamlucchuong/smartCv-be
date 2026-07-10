package vn.chuongpl.payment_service.features.order;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vn.chuongpl.payment_service.enums.OrderStatus;
import vn.payos.PayOS;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class PaymentOrderScheduler {

    PaymentOrderRepository paymentOrderRepository;
    MongoTemplate mongoTemplate;
    PayOS payOS;

    @Scheduled(fixedDelay = 60_000)
    public void cancelExpiredOrders() {
        LocalDateTime expiredBefore = LocalDateTime.now().minusMinutes(5);
        List<PaymentOrder> expiredOrders = paymentOrderRepository
                .findAllByStatusAndCreatedAtBefore(OrderStatus.PENDING, expiredBefore);

        if (expiredOrders.isEmpty()) return;

        log.info("[Scheduler] Found {} expired pending order(s) to cancel", expiredOrders.size());
        for (PaymentOrder order : expiredOrders) {
            try {
                payOS.cancelPaymentLink(order.getOrderCode(), "Payment timeout");
            } catch (Exception e) {
                log.warn("[Scheduler] PayOS cancel failed orderCode={}: {}", order.getOrderCode(), e.getMessage());
            }

            Query query = Query.query(
                    Criteria.where("order_code").is(order.getOrderCode()).and("status").is(OrderStatus.PENDING));
            Update update = new Update()
                    .set("status", OrderStatus.CANCELLED)
                    .set("updated_at", LocalDateTime.now());
            long modified = mongoTemplate.updateFirst(query, update, PaymentOrder.class).getModifiedCount();
            if (modified > 0) {
                log.info("[Scheduler] Cancelled expired order orderCode={}", order.getOrderCode());
            }
        }
    }
}
