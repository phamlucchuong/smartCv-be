package vn.chuongpl.ai_engine_service.integration.cv;

import org.junit.jupiter.api.Test;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.exception.AppException;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class CvTextExtractorTest {

    // Simulates a real S3 presigned URL — %2F separates the 5 credential components.
    private static final String PRESIGNED_URL =
            "https://bucket.s3.ap-southeast-2.amazonaws.com/cvs/test.pdf" +
            "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
            "&X-Amz-Credential=AKIAV7Q6UIEQXX65NOGI%2F20260618%2Fap-southeast-2%2Fs3%2Faws4_request" +
            "&X-Amz-Date=20260618T030000Z" +
            "&X-Amz-Expires=3600" +
            "&X-Amz-SignedHeaders=host" +
            "&X-Amz-Signature=abc123def456abc123def456abc123def456abc123def456abc123def456abcd";

    @Test
    void resolveCvText_presignedUrl_preservesPercentEncodingInCredential() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);

        AtomicReference<URI> capturedUri = new AtomicReference<>();
        // Return plain text (no %PDF magic bytes) so PDFBox is not invoked
        server.expect(req -> capturedUri.set(req.getURI()))
              .andExpect(method(HttpMethod.GET))
              .andRespond(withSuccess("plain cv text", MediaType.TEXT_PLAIN));

        CvTextExtractor extractor = new CvTextExtractor(restTemplate);
        String result = extractor.resolveCvText(null, PRESIGNED_URL);

        assertThat(result).isEqualTo("plain cv text");
        // The %2F separators in X-Amz-Credential must NOT be decoded to / or double-encoded to %252F.
        // If Spring's URI template handler mutates the URL, S3 returns AuthorizationQueryParametersError.
        assertThat(capturedUri.get().toString())
                .contains("X-Amz-Credential=AKIAV7Q6UIEQXX65NOGI%2F20260618%2F");
    }

    @Test
    void resolveCvText_returnsCvTextDirectlyWhenProvided() {
        CvTextExtractor extractor = new CvTextExtractor(new RestTemplate());
        String result = extractor.resolveCvText("direct text", null);
        assertThat(result).isEqualTo("direct text");
    }

    @Test
    void resolveCvText_throwsWhenBothCvTextAndUrlAreBlank() {
        CvTextExtractor extractor = new CvTextExtractor(new RestTemplate());
        assertThatThrownBy(() -> extractor.resolveCvText(null, null))
                .isInstanceOf(AppException.class);
        assertThatThrownBy(() -> extractor.resolveCvText("  ", "  "))
                .isInstanceOf(AppException.class);
    }

    @Test
    void extractFromUpload_supportsDocx() throws Exception {
        byte[] bytes;
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            document.createParagraph().createRun().setText("Java Spring Boot Engineer");
            document.createParagraph().createRun().setText("Built REST APIs with PostgreSQL");
            document.write(outputStream);
            bytes = outputStream.toByteArray();
        }

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "resume.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                bytes
        );

        CvTextExtractor extractor = new CvTextExtractor(new RestTemplate());
        String result = extractor.extractFromUpload(file);

        assertThat(result).contains("Java Spring Boot Engineer");
        assertThat(result).contains("Built REST APIs with PostgreSQL");
    }
}
