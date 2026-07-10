package vn.chuongpl.user_service.features.servicepackage;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.MongoId;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "service_packages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ServicePackage {
    @MongoId
    String id;

    @Indexed(unique = true)
    String name;

    Long price;

    @Field(name = "ai_credits")
    Integer aiCredits;

    @Field(name = "job_limit")
    Integer jobLimit;

    @Field(name = "cv_limit")
    Integer cvLimit;

    @Field(name = "duration_days")
    Integer durationDays;

    PackageCategory category;

    boolean featured;

    List<String> features;

    @Field(name = "created_at")
    LocalDateTime createdAt;

    @Field(name = "updated_at")
    LocalDateTime updatedAt;
}
