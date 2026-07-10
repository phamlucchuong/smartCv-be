package vn.chuongpl.user_service.features.company;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.user_service.enums.JobCategory;
import vn.chuongpl.user_service.features.recruiter.Recruiter;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CompanyResponse {
    String id;
    String name;
    String logoUrl;
    String coverImageUrl;
    String industry;
    JobCategory category;
    String size;
    String location;
    String website;
    String description;
    Integer foundedYear;
    Integer activeJobCount;
    List<String> benefits;
    Double rating;
    Integer reviewCount;

    public static CompanyResponse from(Recruiter r) {
        return CompanyResponse.builder()
                .id(r.getId())
                .name(r.getCompanyName())
                .logoUrl(r.getLogoUrl())
                .coverImageUrl(r.getCoverImageUrl())
                .industry(r.getIndustry())
                .category(r.getCategory())
                .size(r.getCompanySize())
                .location(r.getCompanyAddress())
                .website(r.getCompanyWebsite())
                .description(r.getCompanyDescription())
                .foundedYear(r.getFoundedYear())
                .benefits(r.getBenefits())
                .rating(r.getRating())
                .reviewCount(r.getReviewCount())
                .build();
    }
}
