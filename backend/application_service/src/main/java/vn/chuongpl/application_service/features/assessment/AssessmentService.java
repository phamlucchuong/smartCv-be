package vn.chuongpl.application_service.features.assessment;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import vn.chuongpl.application_service.dtos.request.AssessmentAnswerRequest;
import vn.chuongpl.application_service.dtos.request.AssessmentCreateRequest;
import vn.chuongpl.application_service.dtos.request.AssessmentGenerateRequest;
import vn.chuongpl.application_service.dtos.response.AssessmentGenerateResponse;
import vn.chuongpl.application_service.dtos.response.AssessmentResponse;
import vn.chuongpl.application_service.dtos.response.AssessmentResultResponse;
import vn.chuongpl.application_service.dtos.response.AttemptStateResponse;
import vn.chuongpl.application_service.dtos.response.AttemptSummaryResponse;
import vn.chuongpl.application_service.enums.*;
import vn.chuongpl.application_service.exception.AppException;
import vn.chuongpl.application_service.integration.ai.AiEngineClient;
import vn.chuongpl.application_service.integration.notification.AssessmentNotificationPublisher;
import vn.chuongpl.application_service.integration.user.UserClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class AssessmentService {

    AssessmentRepository assessmentRepository;
    AssessmentAttemptRepository attemptRepository;
    UserClient userClient;
    AssessmentNotificationPublisher assessmentNotificationPublisher;
    AiEngineClient aiEngineClient;

    private String resolveRecruiterId(String userId) {
        String recruiterId = userClient.resolveRecruiterId(userId);
        if (recruiterId == null)
            throw new AppException(ErrorCode.UNAUTHORIZED);
        return recruiterId;
    }

    public AssessmentResponse createAssessment(AssessmentCreateRequest req, String userId) {
        String recruiterId = resolveRecruiterId(userId);
        Assessment assessment = Assessment.builder()
                .recruiterId(recruiterId)
                .jobId(req.getJobId())
                .title(req.getTitle())
                .description(req.getDescription())
                .questions(req.getQuestions() != null ? req.getQuestions() : List.of())
                .timeLimitMinutes(req.getTimeLimitMinutes())
                .status(AssessmentStatus.DRAFT)
                .createdAt(LocalDateTime.now())
                .build();
        Assessment saved = assessmentRepository.save(assessment);
        return toResponse(saved);
    }

    public AssessmentResponse createSelfAssessment(AssessmentCreateRequest req, String candidateUserId) {
        Assessment assessment = Assessment.builder()
                .candidateId(candidateUserId)
                .title(req.getTitle())
                .description(req.getDescription())
                .questions(req.getQuestions() != null ? req.getQuestions() : List.of())
                .timeLimitMinutes(req.getTimeLimitMinutes())
                .status(AssessmentStatus.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build();
        return toResponse(assessmentRepository.save(assessment));
    }

    public List<AssessmentResponse> getMySelfAssessments(String candidateUserId) {
        return assessmentRepository.findByCandidateId(candidateUserId).stream()
                .map(this::toResponse)
                .toList();
    }

    public List<AssessmentResponse> getRecruiterAssessments(String userId, List<String> roles) {
        List<AssessmentResponse> assessments;
        if (!roles.contains("ROLE_ADMIN")) {
            String recruiterId = resolveRecruiterId(userId);
            assessments = assessmentRepository.findByRecruiterId(recruiterId).stream()
                    .map(this::toResponse)
                    .toList();
        } else {
            assessments = assessmentRepository.findAll().stream()
                    .map(this::toResponse)
                    .toList();
        }
        return assessments;
    }

    public AssessmentResponse updateAssessment(String id, AssessmentCreateRequest req, String userId) {
        Assessment assessment = findAssessmentById(id);
        if (assessment.getRecruiterId() != null) {
            String recruiterId = resolveRecruiterId(userId);
            if (!recruiterId.equals(assessment.getRecruiterId())) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        } else if (assessment.getCandidateId() != null) {
            if (!userId.equals(assessment.getCandidateId())) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        } else {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        assessment.setTitle(req.getTitle());
        assessment.setDescription(req.getDescription());
        assessment.setJobId(req.getJobId());
        assessment.setQuestions(req.getQuestions() != null ? req.getQuestions() : List.of());
        assessment.setTimeLimitMinutes(req.getTimeLimitMinutes());
        Assessment saved = assessmentRepository.save(assessment);
        return toResponse(saved);
    }

    public void deleteAssessment(String id, String userId) {
        Assessment assessment = findAssessmentById(id);
        if (assessment.getRecruiterId() != null) {
            String recruiterId = resolveRecruiterId(userId);
            if (!recruiterId.equals(assessment.getRecruiterId())) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        } else if (assessment.getCandidateId() != null) {
            if (!userId.equals(assessment.getCandidateId())) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
        } else {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        assessmentRepository.delete(assessment);
    }

    public void assignToCandidate(String assessmentId, String candidateId, String userId) {
        String recruiterId = resolveRecruiterId(userId);
        Assessment assessment = findAssessmentById(assessmentId);
        if (!recruiterId.equals(assessment.getRecruiterId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentId(assessmentId)
                .candidateId(candidateId)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .build();
        attemptRepository.save(attempt);
    }

    public AssessmentResponse publishAssessment(String id, String userId) {
        String recruiterId = resolveRecruiterId(userId);
        Assessment assessment = findAssessmentById(id);
        if (!recruiterId.equals(assessment.getRecruiterId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (assessment.getStatus() == AssessmentStatus.DRAFT) {
            assessment.setStatus(AssessmentStatus.ACTIVE);
        } else if (assessment.getStatus() == AssessmentStatus.ACTIVE) {
            assessment.setStatus(AssessmentStatus.DRAFT);
        }
        assessmentRepository.save(assessment);
        return toResponse(assessment);
    }

    public void deleteAttempt(String attemptId, String userId) {
        AssessmentAttempt attempt = findAttemptById(attemptId);
        // If candidate owns the attempt, let them delete it
        if (userId.equals(attempt.getCandidateId())) {
            attemptRepository.delete(attempt);
            return;
        }

        // Otherwise check if recruiter owns the assessment of this attempt
        String recruiterId = resolveRecruiterId(userId);
        Assessment assessment = findAssessmentById(attempt.getAssessmentId());
        if (!recruiterId.equals(assessment.getRecruiterId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        attemptRepository.delete(attempt);
    }

    public List<AttemptSummaryResponse> getAttemptsByAssessment(String assessmentId, String userId) {
        String recruiterId = resolveRecruiterId(userId);
        Assessment assessment = findAssessmentById(assessmentId);
        if (!recruiterId.equals(assessment.getRecruiterId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        return attemptRepository.findByAssessmentId(assessmentId).stream()
                .map(this::toAttemptSummaryResponse)
                .toList();
    }

    public List<AttemptSummaryResponse> getAttemptsByCandidate(String candidateId, String userId) {
        resolveRecruiterId(userId);
        return attemptRepository.findByCandidateId(candidateId).stream()
                .map(this::toAttemptSummaryResponse)
                .toList();
    }

    public List<AttemptStateResponse> getMyAssessments(String candidateId) {
        return attemptRepository.findByCandidateId(candidateId).stream()
                .filter(attempt -> {
                    try {
                        Assessment assessment = findAssessmentById(attempt.getAssessmentId());
                        return assessment.getStatus() == AssessmentStatus.ACTIVE;
                    } catch (Exception e) {
                        return false;
                    }
                })
                .map(this::toAttemptStateResponse)
                .toList();
    }

    public AssessmentResponse getAssessment(String assessmentId) {
        Assessment assessment = findAssessmentById(assessmentId);
        AssessmentResponse response = toResponse(assessment);
        if (response.getQuestions() != null) {
            response.getQuestions().forEach(q -> q.setCorrectOptionIndex(null));
        }
        return response;
    }

    public String startAttempt(String assessmentId, String candidateId) {
        findAssessmentById(assessmentId);
        attemptRepository.findByCandidateIdAndAssessmentIdAndStatus(
                candidateId, assessmentId, AttemptStatus.IN_PROGRESS)
                .ifPresent(a -> {
                    throw new AppException(ErrorCode.ATTEMPT_ALREADY_IN_PROGRESS);
                });

        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentId(assessmentId)
                .candidateId(candidateId)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .build();
        return attemptRepository.save(attempt).getId();
    }

    public void saveAnswers(String attemptId, AssessmentAnswerRequest req, String candidateId) {
        AssessmentAttempt attempt = findAttemptById(attemptId);
        assertOwner(attempt, candidateId);
        if (attempt.getStatus() == AttemptStatus.SUBMITTED) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        }
        attempt.setAnswers(req.getAnswers() != null ? req.getAnswers() : List.of());
        attemptRepository.save(attempt);
    }

    public void submitAttempt(String attemptId, String candidateId, boolean overtime) {
        AssessmentAttempt attempt = findAttemptById(attemptId);
        assertOwner(attempt, candidateId);
        if (attempt.getStatus() == AttemptStatus.SUBMITTED) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        }
        Assessment assessment = findAssessmentById(attempt.getAssessmentId());

        AttemptResult result;
        double score;
        if (overtime) {
            result = AttemptResult.OVERTIME;
            score = 0.0;
        } else {
            Map<String, Question> questionMap = assessment.getQuestions().stream()
                    .collect(Collectors.toMap(Question::getId, q -> q));
            boolean hasText = assessment.getQuestions().stream()
                    .anyMatch(q -> q.getType() == QuestionType.TEXT);
            long mcqTotal = assessment.getQuestions().stream()
                    .filter(q -> q.getType() == QuestionType.MCQ).count();
            long mcqCorrect = attempt.getAnswers().stream()
                    .filter(a -> {
                        Question q = questionMap.get(a.getQuestionId());
                        return q != null && q.getType() == QuestionType.MCQ
                                && q.getCorrectOptionIndex() != null
                                && q.getCorrectOptionIndex().equals(a.getSelectedOptionIndex());
                    }).count();
            score = mcqTotal > 0 ? (double) mcqCorrect / mcqTotal * 100 : 0.0;
            if (hasText) {
                result = AttemptResult.PENDING;
            } else {
                result = score >= 70 ? AttemptResult.PASS : AttemptResult.FAIL;
            }
        }

        attempt.setScore(score);
        attempt.setResult(result);
        attempt.setStatus(AttemptStatus.SUBMITTED);
        attempt.setSubmittedAt(LocalDateTime.now());
        attemptRepository.save(attempt);

        String recruiterUserId = userClient.resolveUserIdFromRecruiterId(assessment.getRecruiterId());
        assessmentNotificationPublisher.publishAssessmentSubmitted(
                AssessmentEventMessage.builder()
                        .attemptId(attempt.getId())
                        .assessmentId(assessment.getId())
                        .assessmentTitle(assessment.getTitle())
                        .candidateId(candidateId)
                        .recruiterId(assessment.getRecruiterId())
                        .recruiterUserId(recruiterUserId)
                        .score(score)
                        .result(result.name())
                        .overtime(overtime)
                        .occurredAt(LocalDateTime.now())
                        .build());
    }

    public AttemptStateResponse getAttemptState(String attemptId, String candidateId) {
        AssessmentAttempt attempt = findAttemptById(attemptId);
        assertOwner(attempt, candidateId);
        return toAttemptStateResponse(attempt);
    }

    public AssessmentResultResponse getResult(String attemptId, String candidateId) {
        AssessmentAttempt attempt = findAttemptById(attemptId);
        assertOwner(attempt, candidateId);
        if (attempt.getStatus() != AttemptStatus.SUBMITTED) {
            throw new AppException(ErrorCode.ATTEMPT_NOT_SUBMITTED);
        }
        Assessment assessment = findAssessmentById(attempt.getAssessmentId());
        AttemptStats attemptStats = summarizeAttempt(assessment, attempt);
        return AssessmentResultResponse.builder()
                .attemptId(attempt.getId())
                .score(attempt.getScore())
                .correctAnswers(attemptStats.correctAnswers())
                .totalQuestions(attemptStats.totalQuestions())
                .result(attempt.getResult())
                .submittedAt(attempt.getSubmittedAt())
                .build();
    }

    private Assessment findAssessmentById(String id) {
        return assessmentRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ASSESSMENT_NOT_FOUND));
    }

    private AssessmentAttempt findAttemptById(String id) {
        return attemptRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ATTEMPT_NOT_FOUND));
    }

    private void assertOwner(AssessmentAttempt attempt, String candidateId) {
        if (!candidateId.equals(attempt.getCandidateId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    private AssessmentResponse toResponse(Assessment a) {
        return AssessmentResponse.builder()
                .id(a.getId())
                .jobId(a.getJobId())
                .recruiterId(a.getRecruiterId())
                .title(a.getTitle())
                .description(a.getDescription())
                .questions(a.getQuestions())
                .timeLimitMinutes(a.getTimeLimitMinutes())
                .status(a.getStatus())
                .createdAt(a.getCreatedAt())
                .build();
    }

    private AttemptStateResponse toAttemptStateResponse(AssessmentAttempt a) {
        Assessment assessment = findAssessmentById(a.getAssessmentId());
        AttemptStats attemptStats = summarizeAttempt(assessment, a);
        return AttemptStateResponse.builder()
                .attemptId(a.getId())
                .assessmentId(a.getAssessmentId())
                .status(a.getStatus())
                .answers(a.getAnswers())
                .startedAt(a.getStartedAt())
                .score(a.getScore())
                .correctAnswers(attemptStats.correctAnswers())
                .totalQuestions(attemptStats.totalQuestions())
                .result(a.getResult())
                .build();
    }

    private AttemptSummaryResponse toAttemptSummaryResponse(AssessmentAttempt a) {
        Assessment assessment = findAssessmentById(a.getAssessmentId());
        AttemptStats attemptStats = summarizeAttempt(assessment, a);
        return AttemptSummaryResponse.builder()
                .attemptId(a.getId())
                .assessmentId(a.getAssessmentId())
                .candidateId(a.getCandidateId())
                .status(a.getStatus())
                .score(a.getScore())
                .correctAnswers(attemptStats.correctAnswers())
                .totalQuestions(attemptStats.totalQuestions())
                .result(a.getResult())
                .submittedAt(a.getSubmittedAt())
                .build();
    }

    private AttemptStats summarizeAttempt(Assessment assessment, AssessmentAttempt attempt) {
        Map<String, Question> questionMap = assessment.getQuestions().stream()
                .collect(Collectors.toMap(Question::getId, q -> q));
        int totalQuestions = (int) assessment.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.MCQ)
                .count();
        int correctAnswers = (int) attempt.getAnswers().stream()
                .filter(answer -> {
                    Question question = questionMap.get(answer.getQuestionId());
                    return question != null
                            && question.getType() == QuestionType.MCQ
                            && question.getCorrectOptionIndex() != null
                            && question.getCorrectOptionIndex().equals(answer.getSelectedOptionIndex());
                })
                .count();
        return new AttemptStats(correctAnswers, totalQuestions);
    }

    private record AttemptStats(int correctAnswers, int totalQuestions) {}

    public List<AssessmentResponse> getAssessmentsByJob(String jobId) {
        return assessmentRepository.findByJobId(jobId).stream()
                .filter(a -> a.getStatus() == AssessmentStatus.ACTIVE)
                .map(a -> {
                    AssessmentResponse res = toResponse(a);
                    if (res.getQuestions() != null) {
                        res.getQuestions().forEach(q -> q.setCorrectOptionIndex(null));
                    }
                    return res;
                })
                .toList();
    }

    public List<AssessmentResponse> getAssessmentsByRecruiter(String recruiterId) {
        return assessmentRepository.findByRecruiterId(recruiterId).stream()
                .filter(a -> a.getStatus() == AssessmentStatus.ACTIVE)
                .map(a -> {
                    AssessmentResponse res = toResponse(a);
                    if (res.getQuestions() != null) {
                        res.getQuestions().forEach(q -> q.setCorrectOptionIndex(null));
                    }
                    return res;
                })
                .toList();
    }

    public AssessmentGenerateResponse generateQuestions(AssessmentGenerateRequest request) {
        return aiEngineClient.generateQuestions(request);
    }
}
