package vn.chuongpl.ai_engine_service.features.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.ai_engine_service.dtos.ApiResponse;

import java.util.List;

@RestController
@RequestMapping("/api/ai/admin/usage-report")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AiReportController {

    private final AiReportService reportService;

    @GetMapping
    public ApiResponse<List<AiUsageReportItem>> getReport(
            @RequestParam(defaultValue = "week") String timeframe) {
        return ApiResponse.<List<AiUsageReportItem>>builder()
                .data(reportService.getUsageReport(timeframe))
                .build();
    }
}
