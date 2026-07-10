package vn.chuongpl.job_service.features.job;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Document(indexName = "jobs")
public class JobDocument {
    @Id
    String id;
    @Field(type = FieldType.Keyword)
    String recruiterId;
    @Field(type = FieldType.Text, analyzer = "standard")
    String title;
    @Field(type = FieldType.Text, analyzer = "standard")
    String description;
    @MultiField(mainField = @Field(type = FieldType.Text),
            otherFields = @InnerField(suffix = "keyword", type = FieldType.Keyword))
    String company;
    @Field(type = FieldType.Keyword)
    String location;
    @Field(type = FieldType.Double)
    Double salaryMin;
    @Field(type = FieldType.Double)
    Double salaryMax;
    @Field(type = FieldType.Keyword)
    String jobType;
    @Field(type = FieldType.Keyword)
    String experienceLevel;
    @Field(type = FieldType.Keyword)
    List<String> skills;
    @Field(type = FieldType.Keyword)
    String moderationStatus;
    @Field(type = FieldType.Keyword)
    String visibilityStatus;
    @Field(type = FieldType.Keyword)
    String category;
    @Field(type = FieldType.Date, format = {}, pattern = "uuuu-MM-dd")
    LocalDate deadline;
    @Field(type = FieldType.Integer)
    Integer openings;
    @Field(type = FieldType.Date, format = {}, pattern = "uuuu-MM-dd'T'HH:mm:ss")
    LocalDateTime createdAt;
}
