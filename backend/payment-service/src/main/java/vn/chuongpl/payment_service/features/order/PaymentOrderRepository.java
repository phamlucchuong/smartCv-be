package vn.chuongpl.payment_service.features.order;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import vn.chuongpl.payment_service.enums.OrderStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentOrderRepository extends MongoRepository<PaymentOrder, String> {
    Optional<PaymentOrder> findByOrderCode(Long orderCode);
    Optional<PaymentOrder> findByIdAndUserId(String id, String userId);
    Optional<PaymentOrder> findByUserIdAndPackageIdAndStatus(String userId, String packageId, OrderStatus status);
    Page<PaymentOrder> findByUserId(String userId, Pageable pageable);
    List<PaymentOrder> findAllByStatusAndCreatedAtBefore(OrderStatus status, LocalDateTime createdAt);
}
