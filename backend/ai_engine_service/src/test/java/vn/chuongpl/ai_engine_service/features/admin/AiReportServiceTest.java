package vn.chuongpl.ai_engine_service.features.admin;

import org.junit.jupiter.api.Test;
import vn.chuongpl.ai_engine_service.features.analysis.AiUsageLog;
import vn.chuongpl.ai_engine_service.features.analysis.AiUsageLogRepository;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiReportServiceTest {

    private final AiUsageLogRepository repository = mock(AiUsageLogRepository.class);
    private final AiReportService service = new AiReportService(repository);

    @Test
    void shouldBuildWeekReportUsingWeekdaysOfCurrentWeek() {
        LocalDateTime monday = LocalDateTime.now()
                .with(DayOfWeek.MONDAY)
                .withHour(9)
                .withMinute(0)
                .withSecond(0)
                .withNano(0);
        LocalDateTime sunday = monday.plusDays(6).withHour(15);

        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of(
                usageLog(monday, 100, 40, 1.25),
                usageLog(sunday, 80, 20, 0.75)
        ));

        List<AiUsageReportItem> report = service.getUsageReport("week");

        assertThat(report).extracting(AiUsageReportItem::getDate)
                .containsExactly("Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN");
        assertThat(report.get(0).getPromptTokens()).isEqualTo(100);
        assertThat(report.get(6).getCompletionTokens()).isEqualTo(20);
    }

    @Test
    void shouldBuildMonthReportUsingDaysOfCurrentMonth() {
        int currentDay = LocalDateTime.now().getDayOfMonth();
        YearMonth currentMonth = YearMonth.now();

        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of(
                usageLog(LocalDateTime.now().withDayOfMonth(currentDay).withHour(10), 120, 60, 1.8)
        ));

        List<AiUsageReportItem> report = service.getUsageReport("month");

        assertThat(report).hasSize(currentMonth.lengthOfMonth());
        assertThat(report.get(0).getDate()).isEqualTo("1");
        assertThat(report.get(currentDay - 1).getPromptTokens()).isEqualTo(120);
        assertThat(report.get(currentDay - 1).getCompletionTokens()).isEqualTo(60);
    }

    @Test
    void shouldBuildYearReportUsingTwelveMonths() {
        int currentMonth = LocalDateTime.now().getMonthValue();

        when(repository.findByCreatedAtBetween(any(), any())).thenReturn(List.of(
                usageLog(LocalDateTime.now().withMonth(currentMonth).withDayOfMonth(1).withHour(8), 300, 90, 4.5)
        ));

        List<AiUsageReportItem> report = service.getUsageReport("year");

        assertThat(report).hasSize(12);
        assertThat(report).extracting(AiUsageReportItem::getDate)
                .containsExactly("T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12");
        assertThat(report.get(currentMonth - 1).getPromptTokens()).isEqualTo(300);
        assertThat(report.get(currentMonth - 1).getCost()).isEqualTo(4.5);
    }

    private AiUsageLog usageLog(LocalDateTime createdAt, int promptTokens, int completionTokens, double cost) {
        return AiUsageLog.builder()
                .createdAt(createdAt)
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .cost(cost)
                .provider("OpenAI")
                .build();
    }
}
