package vn.chuongpl.ai_engine_service.features.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.chuongpl.ai_engine_service.features.analysis.AiUsageLog;
import vn.chuongpl.ai_engine_service.features.analysis.AiUsageLogRepository;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class AiReportService {

    private final AiUsageLogRepository repository;

    public List<AiUsageReportItem> getUsageReport(String timeframe) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start;
        LocalDateTime end;
        
        if ("day".equalsIgnoreCase(timeframe)) {
            start = now.toLocalDate().atStartOfDay();
            end = start.plusDays(1).minusSeconds(1);
        } else if ("week".equalsIgnoreCase(timeframe)) {
            start = now.toLocalDate()
                    .with(DayOfWeek.MONDAY)
                    .atStartOfDay();
            end = start.plusDays(6).withHour(23).withMinute(59).withSecond(59);
        } else if ("month".equalsIgnoreCase(timeframe)) {
            YearMonth currentMonth = YearMonth.from(now);
            start = currentMonth.atDay(1).atStartOfDay();
            end = currentMonth.atEndOfMonth().atTime(23, 59, 59);
        } else {
            start = now.toLocalDate()
                    .withDayOfYear(1)
                    .atStartOfDay();
            end = now.toLocalDate()
                    .withMonth(12)
                    .withDayOfMonth(31)
                    .atTime(23, 59, 59);
        }

        List<AiUsageLog> logs = repository.findByCreatedAtBetween(start, end);
        
        if ("day".equalsIgnoreCase(timeframe)) {
            return aggregateByHour(logs, start, end);
        } else if ("week".equalsIgnoreCase(timeframe)) {
            return aggregateByWeekday(logs, start);
        } else if ("month".equalsIgnoreCase(timeframe)) {
            return aggregateByMonthDay(logs, start);
        } else {
            return aggregateByMonth(logs);
        }
    }

    private List<AiUsageReportItem> aggregateByHour(List<AiUsageLog> logs, LocalDateTime start, LocalDateTime end) {
        Map<String, AiUsageReportItem> map = new TreeMap<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:00");
        
        for (LocalDateTime time = start; time.isBefore(end); time = time.plusHours(2)) {
            String label = time.format(formatter);
            map.put(label, AiUsageReportItem.builder().date(label).promptTokens(0).completionTokens(0).cost(0.0).build());
        }

        for (AiUsageLog log : logs) {
            String label = log.getCreatedAt().format(formatter);
            String matchedLabel = map.keySet().stream()
                    .filter(k -> Integer.parseInt(k.split(":")[0]) <= log.getCreatedAt().getHour())
                    .reduce((first, second) -> second)
                    .orElse(map.keySet().isEmpty() ? label : map.keySet().iterator().next());
            
            AiUsageReportItem item = map.get(matchedLabel);
            if (item != null) {
                item.setPromptTokens(item.getPromptTokens() + log.getPromptTokens());
                item.setCompletionTokens(item.getCompletionTokens() + log.getCompletionTokens());
                item.setCost(item.getCost() + log.getCost());
            }
        }
        return new ArrayList<>(map.values());
    }

    private List<AiUsageReportItem> aggregateByWeekday(List<AiUsageLog> logs, LocalDateTime start) {
        Map<String, AiUsageReportItem> map = new LinkedHashMap<>();
        List<DayOfWeek> weekdays = List.of(
                DayOfWeek.MONDAY,
                DayOfWeek.TUESDAY,
                DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY,
                DayOfWeek.FRIDAY,
                DayOfWeek.SATURDAY,
                DayOfWeek.SUNDAY
        );

        for (DayOfWeek day : weekdays) {
            String label = formatWeekday(day);
            map.put(label, AiUsageReportItem.builder().date(label).promptTokens(0).completionTokens(0).cost(0.0).build());
        }

        for (AiUsageLog log : logs) {
            String label = formatWeekday(log.getCreatedAt().getDayOfWeek());
            AiUsageReportItem item = map.get(label);
            if (item != null) {
                item.setPromptTokens(item.getPromptTokens() + log.getPromptTokens());
                item.setCompletionTokens(item.getCompletionTokens() + log.getCompletionTokens());
                item.setCost(item.getCost() + log.getCost());
            }
        }
        return new ArrayList<>(map.values());
    }

    private List<AiUsageReportItem> aggregateByMonthDay(List<AiUsageLog> logs, LocalDateTime start) {
        Map<String, AiUsageReportItem> map = new LinkedHashMap<>();

        YearMonth month = YearMonth.from(start);
        IntStream.rangeClosed(1, month.lengthOfMonth()).forEach(day -> {
            String label = String.valueOf(day);
            map.put(label, AiUsageReportItem.builder().date(label).promptTokens(0).completionTokens(0).cost(0.0).build());
        });

        for (AiUsageLog log : logs) {
            String label = String.valueOf(log.getCreatedAt().getDayOfMonth());
            AiUsageReportItem item = map.get(label);
            if (item != null) {
                item.setPromptTokens(item.getPromptTokens() + log.getPromptTokens());
                item.setCompletionTokens(item.getCompletionTokens() + log.getCompletionTokens());
                item.setCost(item.getCost() + log.getCost());
            }
        }
        return new ArrayList<>(map.values());
    }

    private List<AiUsageReportItem> aggregateByMonth(List<AiUsageLog> logs) {
        Map<String, AiUsageReportItem> map = new LinkedHashMap<>();

        IntStream.rangeClosed(1, 12).forEach(month -> {
            String label = "T" + month;
            map.put(label, AiUsageReportItem.builder().date(label).promptTokens(0).completionTokens(0).cost(0.0).build());
        });

        for (AiUsageLog log : logs) {
            String label = "T" + log.getCreatedAt().getMonthValue();
            AiUsageReportItem item = map.get(label);
            if (item != null) {
                item.setPromptTokens(item.getPromptTokens() + log.getPromptTokens());
                item.setCompletionTokens(item.getCompletionTokens() + log.getCompletionTokens());
                item.setCost(item.getCost() + log.getCost());
            }
        }
        return new ArrayList<>(map.values());
    }

    private String formatWeekday(DayOfWeek dayOfWeek) {
        return switch (dayOfWeek) {
            case MONDAY -> "Th 2";
            case TUESDAY -> "Th 3";
            case WEDNESDAY -> "Th 4";
            case THURSDAY -> "Th 5";
            case FRIDAY -> "Th 6";
            case SATURDAY -> "Th 7";
            case SUNDAY -> "CN";
        };
    }
}
