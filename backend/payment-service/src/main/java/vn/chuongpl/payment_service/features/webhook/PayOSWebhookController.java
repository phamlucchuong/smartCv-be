package vn.chuongpl.payment_service.features.webhook;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.payment_service.dtos.ApiResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Slf4j
@RestController
@RequestMapping("/api/webhook")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class PayOSWebhookController {

    PayOSWebhookService payOSWebhookService;

    @RequestMapping(value = {"/payos", "/payos/"}, method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<Void> checkPayOSWebhook() {
        return ResponseEntity.ok().build();
    }

    @PostMapping({"/payos", "/payos/"})
    public ResponseEntity<ApiResponse<Void>> handlePayOSWebhook(HttpServletRequest request) throws IOException {
        String rawBody = new String(request.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        try {
            payOSWebhookService.handleWebhook(rawBody);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("[Webhook] Processing failed", e);
            return ResponseEntity.status(HttpStatus.OK).build();
        }
    }
}
