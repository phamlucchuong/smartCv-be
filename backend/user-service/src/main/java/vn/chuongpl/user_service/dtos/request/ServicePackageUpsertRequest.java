package vn.chuongpl.user_service.dtos.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import vn.chuongpl.user_service.features.servicepackage.PackageCategory;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ServicePackageUpsertRequest {
    @NotBlank
    String name;

    PackageCategory category;

    @NotNull
    @PositiveOrZero
    Long price;

    @NotNull
    @PositiveOrZero
    Integer aiCredits;

    @NotNull
    Integer jobLimit;

    @NotNull
    Integer cvLimit;

    @PositiveOrZero
    Integer durationDays;

    boolean featured;

    List<String> features;
}
