package vn.chuongpl.job_service.integration.userservice;

public record RecruiterStatusDto(String status) {
    public boolean isApproved() {
        return "APPROVED".equals(status);
    }
}
