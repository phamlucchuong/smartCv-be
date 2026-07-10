package vn.chuongpl.user_service.features.cron;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.user_service.dtos.ApiResponse;

@RestController
@RequestMapping("/api/internal/cron")
@RequiredArgsConstructor
public class CronTriggerController {

    private final SubscriptionExpiryScheduler scheduler;

    /**
     * Trigger the subscription expiry check (reset expired packages + send expiry warnings).
     * Equivalent to phase 1 of the daily 2AM cron.
     */
    @PostMapping("/expiry-check")
    public ApiResponse<String> triggerExpiryCheck() {
        scheduler.runExpiryCheck();
        return ApiResponse.<String>builder()
                .message("Subscription expiry check completed")
                .build();
    }

    /**
     * Trigger the grace period cleanup (deactivate excess jobs for recruiters, delete excess CVs for candidates).
     * Equivalent to phase 2 of the daily 2AM cron.
     *
     * @param graceDays Override the grace period in days. Use 0 to force immediate cleanup regardless of downgrade time.
     *                  Defaults to 3 (production value).
     */
    @PostMapping("/grace-period-cleanup")
    public ApiResponse<String> triggerGracePeriodCleanup(
            @RequestParam(defaultValue = "3") int graceDays) {
        scheduler.runGracePeriodCleanup(graceDays);
        return ApiResponse.<String>builder()
                .message("Grace period cleanup completed (graceDays=" + graceDays + ")")
                .build();
    }
}
