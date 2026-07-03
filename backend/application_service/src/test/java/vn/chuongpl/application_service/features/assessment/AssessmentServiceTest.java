package vn.chuongpl.application_service.features.assessment;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.application_service.dtos.request.AssessmentAnswerRequest;
import vn.chuongpl.application_service.dtos.request.AssessmentCreateRequest;
import vn.chuongpl.application_service.dtos.response.AssessmentResponse;
import vn.chuongpl.application_service.dtos.response.AttemptSummaryResponse;
import vn.chuongpl.application_service.enums.*;
import vn.chuongpl.application_service.dtos.request.AssessmentGenerateRequest;
import vn.chuongpl.application_service.dtos.response.AssessmentGenerateResponse;
import vn.chuongpl.application_service.dtos.response.GeneratedQuestion;
import vn.chuongpl.application_service.exception.AppException;
import vn.chuongpl.application_service.integration.ai.AiEngineClient;
import vn.chuongpl.application_service.integration.notification.AssessmentNotificationPublisher;
import vn.chuongpl.application_service.integration.user.UserClient;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AssessmentServiceTest {
    @Mock AssessmentRepository assessmentRepository;
    @Mock AssessmentAttemptRepository attemptRepository;
    @Mock UserClient userClient;
    @Mock AssessmentNotificationPublisher assessmentNotificationPublisher;
    @Mock AiEngineClient aiEngineClient;
    @InjectMocks AssessmentService assessmentService;

    @Test
    void createAssessment_shouldSaveWithDraftStatusAndReturnResponse() {
        AssessmentCreateRequest req = new AssessmentCreateRequest();
        req.setTitle("Java Test");
        req.setDescription("Basic Java knowledge");
        req.setQuestions(List.of());
        req.setTimeLimitMinutes(30);

        when(userClient.resolveRecruiterId("u1")).thenReturn("r1");
        Assessment saved = Assessment.builder()
                .id("a1").title("Java Test").status(AssessmentStatus.DRAFT)
                .recruiterId("r1").createdAt(LocalDateTime.now()).build();
        when(assessmentRepository.save(any(Assessment.class))).thenReturn(saved);

        AssessmentResponse response = assessmentService.createAssessment(req, "u1");

        assertEquals("a1", response.getId());
        assertEquals(AssessmentStatus.DRAFT, response.getStatus());
        verify(assessmentRepository).save(any(Assessment.class));
    }

    @Test
    void assignToCandidate_shouldCreateInProgressAttemptWithoutChangingAssessmentStatus() {
        when(userClient.resolveRecruiterId("u1")).thenReturn("r1");
        Assessment assessment = Assessment.builder()
                .id("a1").recruiterId("r1").status(AssessmentStatus.DRAFT).build();
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));
        when(attemptRepository.save(any(AssessmentAttempt.class))).thenAnswer(i -> i.getArgument(0));

        assessmentService.assignToCandidate("a1", "c1", "u1");

        ArgumentCaptor<AssessmentAttempt> captor = ArgumentCaptor.forClass(AssessmentAttempt.class);
        verify(attemptRepository).save(captor.capture());
        assertEquals("c1", captor.getValue().getCandidateId());
        assertEquals(AttemptStatus.IN_PROGRESS, captor.getValue().getStatus());

        // Assessment status must NOT change — publish button owns this transition
        assertEquals(AssessmentStatus.DRAFT, assessment.getStatus());
        verify(assessmentRepository, never()).save(any(Assessment.class));
    }

    @Test
    void startAttempt_shouldCreateNewAttemptAndReturnAttemptId() {
        Assessment assessment = Assessment.builder().id("a1").status(AssessmentStatus.ACTIVE).build();
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));
        when(attemptRepository.findByCandidateIdAndAssessmentIdAndStatus("c1", "a1", AttemptStatus.IN_PROGRESS))
                .thenReturn(Optional.empty());
        AssessmentAttempt saved = AssessmentAttempt.builder().id("att1").build();
        when(attemptRepository.save(any(AssessmentAttempt.class))).thenReturn(saved);

        String attemptId = assessmentService.startAttempt("a1", "c1");

        assertEquals("att1", attemptId);
    }

    @Test
    void startAttempt_shouldThrowWhenAttemptAlreadyInProgress() {
        Assessment assessment = Assessment.builder().id("a1").status(AssessmentStatus.ACTIVE).build();
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));
        AssessmentAttempt existing = AssessmentAttempt.builder().id("att1").status(AttemptStatus.IN_PROGRESS).build();
        when(attemptRepository.findByCandidateIdAndAssessmentIdAndStatus("c1", "a1", AttemptStatus.IN_PROGRESS))
                .thenReturn(Optional.of(existing));

        AppException ex = assertThrows(AppException.class, () -> assessmentService.startAttempt("a1", "c1"));
        assertEquals(ErrorCode.ATTEMPT_ALREADY_IN_PROGRESS, ex.getErrorCode());
    }

    @Test
    void saveAnswers_shouldReplaceAnswerListAndPersist() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .id("att1").candidateId("c1").status(AttemptStatus.IN_PROGRESS)
                .answers(new ArrayList<>()).build();
        when(attemptRepository.findById("att1")).thenReturn(Optional.of(attempt));

        AssessmentAnswerRequest req = new AssessmentAnswerRequest();
        req.setAnswers(List.of(new AttemptAnswer("q1", 2, null)));

        assessmentService.saveAnswers("att1", req, "c1");

        assertEquals(1, attempt.getAnswers().size());
        assertEquals("q1", attempt.getAnswers().get(0).getQuestionId());
        verify(attemptRepository).save(attempt);
    }

    @Test
    void saveAnswers_shouldThrowWhenAttemptAlreadySubmitted() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .id("att1").candidateId("c1").status(AttemptStatus.SUBMITTED).build();
        when(attemptRepository.findById("att1")).thenReturn(Optional.of(attempt));

        AppException ex = assertThrows(AppException.class,
                () -> assessmentService.saveAnswers("att1", new AssessmentAnswerRequest(), "c1"));
        assertEquals(ErrorCode.ATTEMPT_ALREADY_SUBMITTED, ex.getErrorCode());
    }

    @Test
    void submitAttempt_shouldGradeMcqQuestionsAndSetPassResult() {
        Question q1 = Question.builder().id("q1").type(QuestionType.MCQ).correctOptionIndex(1).build();
        Question q2 = Question.builder().id("q2").type(QuestionType.MCQ).correctOptionIndex(0).build();
        Assessment assessment = Assessment.builder().id("a1").recruiterId("r1")
                .questions(List.of(q1, q2)).build();

        AttemptAnswer ans1 = new AttemptAnswer("q1", 1, null);
        AttemptAnswer ans2 = new AttemptAnswer("q2", 1, null);
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .id("att1").candidateId("c1").assessmentId("a1")
                .status(AttemptStatus.IN_PROGRESS)
                .answers(new ArrayList<>(List.of(ans1, ans2))).build();

        when(attemptRepository.findById("att1")).thenReturn(Optional.of(attempt));
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));
        when(attemptRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(userClient.resolveUserIdFromRecruiterId("r1")).thenReturn("u1");
        doNothing().when(assessmentNotificationPublisher).publishAssessmentSubmitted(any());

        assessmentService.submitAttempt("att1", "c1", false);

        assertEquals(AttemptStatus.SUBMITTED, attempt.getStatus());
        assertEquals(50.0, attempt.getScore());
        assertEquals(AttemptResult.FAIL, attempt.getResult());
        assertNotNull(attempt.getSubmittedAt());
        verify(assessmentNotificationPublisher).publishAssessmentSubmitted(any());
    }

    @Test
    void submitAttempt_shouldSetPendingResultWhenTextQuestionsPresent() {
        Question q1 = Question.builder().id("q1").type(QuestionType.MCQ).correctOptionIndex(0).build();
        Question q2 = Question.builder().id("q2").type(QuestionType.TEXT).build();
        Assessment assessment = Assessment.builder().id("a1").recruiterId("r1").questions(List.of(q1, q2)).build();

        AttemptAnswer ans1 = new AttemptAnswer("q1", 0, null);
        AttemptAnswer ans2 = new AttemptAnswer("q2", null, "My answer");
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .id("att1").candidateId("c1").assessmentId("a1")
                .status(AttemptStatus.IN_PROGRESS)
                .answers(new ArrayList<>(List.of(ans1, ans2))).build();

        when(attemptRepository.findById("att1")).thenReturn(Optional.of(attempt));
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));
        when(attemptRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(userClient.resolveUserIdFromRecruiterId("r1")).thenReturn("u1");
        doNothing().when(assessmentNotificationPublisher).publishAssessmentSubmitted(any());

        assessmentService.submitAttempt("att1", "c1", false);

        assertEquals(AttemptResult.PENDING, attempt.getResult());
    }

    @Test
    void submitAttempt_withOvertime_shouldSetOvertimeResultAndSkipScoring() {
        Question q1 = Question.builder().id("q1").type(QuestionType.MCQ).correctOptionIndex(0).build();
        Assessment assessment = Assessment.builder().id("a1").recruiterId("r1")
                .questions(List.of(q1)).build();

        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .id("att1").candidateId("c1").assessmentId("a1")
                .status(AttemptStatus.IN_PROGRESS)
                .answers(new ArrayList<>()).build();

        when(attemptRepository.findById("att1")).thenReturn(Optional.of(attempt));
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));
        when(attemptRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(userClient.resolveUserIdFromRecruiterId("r1")).thenReturn("u1");
        doNothing().when(assessmentNotificationPublisher).publishAssessmentSubmitted(any());

        assessmentService.submitAttempt("att1", "c1", true);

        assertEquals(AttemptStatus.SUBMITTED, attempt.getStatus());
        assertEquals(0.0, attempt.getScore());
        assertEquals(AttemptResult.OVERTIME, attempt.getResult());
        assertNotNull(attempt.getSubmittedAt());
    }

    @Test
    void publishAssessment_shouldPromoteDraftToActive() {
        when(userClient.resolveRecruiterId("u1")).thenReturn("r1");
        Assessment assessment = Assessment.builder()
                .id("a1").recruiterId("r1").status(AssessmentStatus.DRAFT).build();
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));
        when(assessmentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        AssessmentResponse response = assessmentService.publishAssessment("a1", "u1");

        assertEquals(AssessmentStatus.ACTIVE, assessment.getStatus());
        verify(assessmentRepository).save(assessment);
    }

    @Test
    void publishAssessment_shouldDemoteActiveToDraft() {
        when(userClient.resolveRecruiterId("u1")).thenReturn("r1");
        Assessment assessment = Assessment.builder()
                .id("a1").recruiterId("r1").status(AssessmentStatus.ACTIVE).build();
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));
        when(assessmentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        AssessmentResponse response = assessmentService.publishAssessment("a1", "u1");

        assertEquals(AssessmentStatus.DRAFT, assessment.getStatus());
        assertEquals(AssessmentStatus.DRAFT, response.getStatus());
        verify(assessmentRepository).save(assessment);
    }

    @Test
    void publishAssessment_shouldThrowWhenWrongRecruiter() {
        when(userClient.resolveRecruiterId("u2")).thenReturn("r2");
        Assessment assessment = Assessment.builder()
                .id("a1").recruiterId("r1").status(AssessmentStatus.DRAFT).build();
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));

        AppException ex = assertThrows(AppException.class,
                () -> assessmentService.publishAssessment("a1", "u2"));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
    }

    @Test
    void getAttemptsByAssessment_shouldReturnAttemptsForOwningRecruiter() {
        when(userClient.resolveRecruiterId("u1")).thenReturn("r1");
        Assessment assessment = Assessment.builder()
                .id("a1").recruiterId("r1")
                .questions(List.of(
                        Question.builder().id("q1").type(QuestionType.MCQ).correctOptionIndex(1).build(),
                        Question.builder().id("q2").type(QuestionType.MCQ).correctOptionIndex(0).build()
                ))
                .build();
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));

        AssessmentAttempt att1 = AssessmentAttempt.builder()
                .id("att1").assessmentId("a1").candidateId("c1")
                .answers(List.of(
                        new AttemptAnswer("q1", 1, null),
                        new AttemptAnswer("q2", 1, null)
                ))
                .status(AttemptStatus.SUBMITTED).score(80.0).result(AttemptResult.PASS).build();
        AssessmentAttempt att2 = AssessmentAttempt.builder()
                .id("att2").assessmentId("a1").candidateId("c2")
                .status(AttemptStatus.IN_PROGRESS).build();
        when(attemptRepository.findByAssessmentId("a1")).thenReturn(List.of(att1, att2));

        List<AttemptSummaryResponse> result = assessmentService.getAttemptsByAssessment("a1", "u1");

        assertEquals(2, result.size());
        assertEquals("att1", result.get(0).getAttemptId());
        assertEquals(80.0, result.get(0).getScore());
        assertEquals(1, result.get(0).getCorrectAnswers());
        assertEquals(2, result.get(0).getTotalQuestions());
        assertEquals(AttemptResult.PASS, result.get(0).getResult());
    }

    @Test
    void getAttemptsByAssessment_shouldThrowWhenWrongRecruiter() {
        when(userClient.resolveRecruiterId("u2")).thenReturn("r2");
        Assessment assessment = Assessment.builder()
                .id("a1").recruiterId("r1").build();
        when(assessmentRepository.findById("a1")).thenReturn(Optional.of(assessment));

        AppException ex = assertThrows(AppException.class,
                () -> assessmentService.getAttemptsByAssessment("a1", "u2"));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
    }

    @Test
    void getResult_shouldThrowWhenAttemptNotYetSubmitted() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .id("att1").candidateId("c1").status(AttemptStatus.IN_PROGRESS).build();
        when(attemptRepository.findById("att1")).thenReturn(Optional.of(attempt));

        AppException ex = assertThrows(AppException.class,
                () -> assessmentService.getResult("att1", "c1"));
        assertEquals(ErrorCode.ATTEMPT_NOT_SUBMITTED, ex.getErrorCode());
    }

    @Test
    void generateQuestions_shouldDelegateToAiEngineClient() {
        AssessmentGenerateRequest request = new AssessmentGenerateRequest("React Developer", "Junior", "Trung bình", 5);
        List<GeneratedQuestion> questions = List.of(
                new GeneratedQuestion("What is JSX?", List.of("A", "B", "C", "D"), 0)
        );
        AssessmentGenerateResponse expected = new AssessmentGenerateResponse(questions);
        when(aiEngineClient.generateQuestions(request)).thenReturn(expected);

        AssessmentGenerateResponse result = assessmentService.generateQuestions(request);

        assertEquals(1, result.questions().size());
        assertEquals("What is JSX?", result.questions().get(0).text());
        verify(aiEngineClient).generateQuestions(request);
    }
}
