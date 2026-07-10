package vn.chuongpl.user_service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.candidate.CvAnalysisStatus;
import vn.chuongpl.user_service.features.candidate.InternalCandidateController;
import vn.chuongpl.user_service.features.candidate.dto.CvAnalysisUpdateRequest;
import vn.chuongpl.user_service.features.candidate.dto.CvInfoResponse;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class InternalCandidateControllerTest {

    MockMvc mockMvc;

    @Mock
    CandidateService candidateService;

    @InjectMocks
    InternalCandidateController controller;

    ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void getCvInfo_returns_200_with_cv_data() throws Exception {
        CvInfoResponse info = new CvInfoResponse("cv-1", "https://s3.example.com/cv.pdf", "cv.pdf", "user-1");
        when(candidateService.getCvInfo("cv-1")).thenReturn(info);

        mockMvc.perform(get("/api/internal/candidates/cvs/cv-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cvId").value("cv-1"))
                .andExpect(jsonPath("$.data.ownerId").value("user-1"));
    }

    @Test
    void updateCvAnalysis_returns_200() throws Exception {
        CvAnalysisUpdateRequest req = new CvAnalysisUpdateRequest("{\"overallScore\":78}", CvAnalysisStatus.DONE);
        doNothing().when(candidateService).updateCvAnalysis("cv-1", req.analysisResult(), req.analysisStatus());

        mockMvc.perform(patch("/api/internal/candidates/cvs/cv-1/analysis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }
}
