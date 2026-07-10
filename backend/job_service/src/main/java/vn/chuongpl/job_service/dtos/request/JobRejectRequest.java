package vn.chuongpl.job_service.dtos.request;

import jakarta.validation.constraints.NotBlank;

public record JobRejectRequest(@NotBlank String note) {
}
