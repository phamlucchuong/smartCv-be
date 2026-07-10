package vn.chuongpl.application_service.dtos.response;

import java.util.List;

public record GeneratedQuestion(String text, List<String> options, int correctOptionIndex) {}
