package vn.chuongpl.payment_service.features.order;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import vn.chuongpl.payment_service.dtos.response.CreateOrderResponse;
import vn.chuongpl.payment_service.dtos.response.OrderResponse;

@Mapper(componentModel = "spring")
public interface PaymentOrderMapper {

    @Mapping(source = "id", target = "orderId")
    @Mapping(source = "paymentUrl", target = "paymentUrl")
    CreateOrderResponse toCreateOrderResponse(PaymentOrder order);

    @Mapping(source = "id", target = "orderId")
    OrderResponse toOrderResponse(PaymentOrder order);
}
