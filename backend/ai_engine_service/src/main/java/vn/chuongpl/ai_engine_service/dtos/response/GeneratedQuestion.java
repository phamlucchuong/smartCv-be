package vn.chuongpl.ai_engine_service.dtos.response;

import java.util.List;

public record GeneratedQuestion(String text, List<String> options, int correctOptionIndex) {}
