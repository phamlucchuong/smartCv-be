package vn.chuongpl.ai_engine_service.features.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.chuongpl.ai_engine_service.config.SecurityConfig;
import vn.chuongpl.ai_engine_service.model.AiProvider;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AiAdminController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SecurityConfig.class)
class AiAdminControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean AiAdminService adminService;

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    void listModels_admin_returns_200() throws Exception {
        when(adminService.listAll()).thenReturn(List.of());

        mvc.perform(get("/api/ai/admin/models"))
            .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(authorities = "ROLE_CANDIDATE")
    void listModels_non_admin_returns_403() throws Exception {
        mvc.perform(get("/api/ai/admin/models"))
            .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    void createModel_admin_calls_service_and_returns_200() throws Exception {
        var response = AiProviderConfigResponse.builder()
                .id("cfg-1")
                .name("Gemini Main")
                .provider(AiProvider.GEMINI)
                .model("gemini-2.5-flash")
                .active(false)
                .configured(true)
                .build();
        when(adminService.create(any())).thenReturn(response);

        mvc.perform(post("/api/ai/admin/models")
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "Gemini Main",
                                  "provider": "GEMINI",
                                  "model": "gemini-2.5-flash",
                                  "apiKey": "secret"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("cfg-1"))
                .andExpect(jsonPath("$.data.name").value("Gemini Main"));

        verify(adminService).create(any());
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    void activateModel_admin_calls_service_and_returns_200() throws Exception {
        var response = AiProviderConfigResponse.builder()
                .id("cfg-1")
                .provider(AiProvider.GEMINI)
                .active(true)
                .configured(true)
                .build();
        when(adminService.activate("cfg-1")).thenReturn(response);

        mvc.perform(put("/api/ai/admin/models/cfg-1/activate"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.provider").value("GEMINI"))
            .andExpect(jsonPath("$.data.active").value(true));

        verify(adminService).activate("cfg-1");
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    void deleteModel_admin_returns_200() throws Exception {
        doNothing().when(adminService).delete("cfg-1");

        mvc.perform(delete("/api/ai/admin/models/cfg-1"))
            .andExpect(status().isOk());

        verify(adminService).delete("cfg-1");
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    void getActiveModel_returns_active_response() throws Exception {
        var response = AiProviderConfigResponse.builder()
                .provider(AiProvider.GEMINI).active(true).configured(true).build();
        when(adminService.getActive()).thenReturn(response);

        mvc.perform(get("/api/ai/admin/models/active"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.active").value(true));
    }
}
