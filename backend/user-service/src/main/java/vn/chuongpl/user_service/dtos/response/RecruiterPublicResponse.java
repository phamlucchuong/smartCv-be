package vn.chuongpl.user_service.dtos.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.user_service.enums.RecruiterStatus;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RecruiterPublicResponse {
    String id;
    String userId;

    String fullName;
    String email;
    String phone;

    String companyName;
    String companyWebsite;
    String companyAddress;
    String companyCity;
    String companyDescription;
    String companyPhone;
    String companySize;
    String companyType;
    Integer foundedYear;
    String industry;

    String logoUrl;
    String coverImageUrl;

    String taxCode;
    String businessLicenseUrl;

    String linkedinUrl;
    String facebookUrl;

    String contactName;
    String contactEmail;
    String contactPhone;

    RecruiterStatus status;
    int quotaJobPost;
    int quotaCvViews;

    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
