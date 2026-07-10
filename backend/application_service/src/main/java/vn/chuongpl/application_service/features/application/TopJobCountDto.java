package vn.chuongpl.application_service.features.application;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class TopJobCountDto {
    String jobId;
    long count;
}
