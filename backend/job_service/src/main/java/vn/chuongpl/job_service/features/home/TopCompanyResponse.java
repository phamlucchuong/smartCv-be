package vn.chuongpl.job_service.features.home;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@NoArgsConstructor
public class TopCompanyResponse implements Serializable {
    private static final long serialVersionUID = 1L;
    String recruiterId;
    String companyId;
    String name;
    String location;
    String logoUrl;
    String coverImageUrl;
    String industry;
    long activeJobCount;
}
