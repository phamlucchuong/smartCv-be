package vn.chuongpl.payment_service.features.order;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.MongoId;
import vn.chuongpl.payment_service.enums.OrderStatus;

import java.time.LocalDateTime;

@Document(collection = "payment_orders")
@CompoundIndexes({
        @CompoundIndex(def = "{'userId': 1, 'packageId': 1, 'status': 1}"),
        @CompoundIndex(def = "{'userId': 1, 'status': 1}")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PaymentOrder {

    @MongoId
    String id;

    @Indexed(unique = true)
    @Field("order_code")
    Long orderCode;

    @Field("user_id")
    String userId;

    @Field("user_role")
    String userRole;

    @Field("package_id")
    String packageId;

    @Field("package_name")
    String packageName;

    @Field("package_ai_credits")
    Integer packageAiCredits;

    @Field("package_job_limit")
    Integer packageJobLimit;

    @Field("package_cv_limit")
    Integer packageCvLimit;

    @Field("package_duration_days")
    Integer packageDurationDays;

    Long amount;

    @Indexed
    OrderStatus status;

    @Field("payment_url")
    String paymentUrl;

    @Field("qr_code")
    String qrCode;

    @Field("created_at")
    LocalDateTime createdAt;

    @Field("updated_at")
    LocalDateTime updatedAt;

    @Field("paid_at")
    LocalDateTime paidAt;
}
