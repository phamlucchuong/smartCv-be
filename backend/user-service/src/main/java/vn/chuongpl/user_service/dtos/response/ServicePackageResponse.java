package vn.chuongpl.user_service.dtos.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import vn.chuongpl.user_service.features.servicepackage.PackageCategory;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ServicePackageResponse {
    String id;
    String name;
    Long price;
    Integer aiCredits;
    Integer jobLimit;
    Integer cvLimit;
    Integer durationDays;
    PackageCategory category;
    boolean featured;
    List<String> features;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
