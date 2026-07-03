package vn.chuongpl.ai_engine_service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import vn.chuongpl.ai_engine_service.dtos.request.CvFullAnalysisRequest;
import vn.chuongpl.ai_engine_service.dtos.response.CvFullAnalysisResponse;
import vn.chuongpl.ai_engine_service.dtos.response.StrengthItem;
import vn.chuongpl.ai_engine_service.dtos.response.WeaknessItem;
import vn.chuongpl.ai_engine_service.features.analysis.AnalysisController;
import vn.chuongpl.ai_engine_service.features.analysis.AnalysisService;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AnalysisControllerCvFullTest {

    @Mock
    AnalysisService analysisService;

    @InjectMocks
    AnalysisController analysisController;

    ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void analyzeCv_returns_200_with_analysis_data() throws Exception {
        // For standaloneSetup, @AuthenticationPrincipal will be null unless we set a principal
        // We'll mock analysisService.analyzeCv with any userId matcher
        CvFullAnalysisResponse response = new CvFullAnalysisResponse(
                78, "Good", "Backend Engineer", 78,
                List.of("Java"), List.of("Kubernetes"), List.of("PHP"),
                "Good match.", "Phù hợp tốt.",
                List.of(new StrengthItem("Tech", "Java expert", "Chuyên gia Java")),
                List.of(new WeaknessItem("Cloud", "No K8s", "Thiếu Kubernetes")),
                List.of(),
                List.of("Java", "PHP")
        );
        when(analysisService.analyzeCv(any(CvFullAnalysisRequest.class), any(), anyBoolean()))
                .thenReturn(response);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(analysisController).build();

        mockMvc.perform(post("/api/ai/analyze-cv")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CvFullAnalysisRequest("cv-1", null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallScore").value(78))
                .andExpect(jsonPath("$.data.scoreLabel").value("Good"))
                .andExpect(jsonPath("$.data.targetPosition").value("Backend Engineer"));
    }
}
