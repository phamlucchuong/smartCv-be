package vn.chuongpl.ai_engine_service.integration.cv;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;

@Component
@Slf4j
@RequiredArgsConstructor
public class CvTextExtractor {

    private final RestTemplate restTemplate;

    public String resolveCvText(String cvText, String cvUrl) {
        if (cvText != null && !cvText.isBlank()) {
            return cvText.trim();
        }
        if (cvUrl == null || cvUrl.isBlank()) {
            throw new AppException(ErrorCode.CV_TEXT_REQUIRED);
        }

        try {
            byte[] fileBytes = restTemplate.getForObject(URI.create(cvUrl), byte[].class);
            if (fileBytes == null || fileBytes.length == 0) {
                throw new AppException(ErrorCode.CV_TEXT_REQUIRED);
            }
            return extractText(fileBytes, filenameFromUrl(cvUrl));
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to extract CV text: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_PROCESSING_FAILED);
        }
    }

    public String extractFromUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.CV_TEXT_REQUIRED);
        }

        try {
            byte[] fileBytes = file.getBytes();
            if (fileBytes.length == 0) {
                throw new AppException(ErrorCode.CV_TEXT_REQUIRED);
            }
            return extractText(fileBytes, file.getOriginalFilename());
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to extract uploaded CV text: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_PROCESSING_FAILED);
        }
    }

    private boolean looksLikePdf(byte[] bytes) {
        return bytes.length >= 4 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F';
    }

    private String extractText(byte[] fileBytes, String filename) throws Exception {
        if (looksLikePdf(fileBytes)) {
            try (PDDocument document = Loader.loadPDF(fileBytes)) {
                return new PDFTextStripper().getText(document).trim();
            }
        }
        if (looksLikeDocx(fileBytes, filename)) {
            try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(fileBytes))) {
                StringBuilder text = new StringBuilder();
                document.getParagraphs().forEach(paragraph -> {
                    String value = paragraph.getText();
                    if (value != null && !value.isBlank()) {
                        if (!text.isEmpty()) {
                            text.append('\n');
                        }
                        text.append(value.trim());
                    }
                });
                return text.toString().trim();
            }
        }
        return new String(fileBytes, StandardCharsets.UTF_8).trim();
    }

    private boolean looksLikeDocx(byte[] bytes, String filename) {
        String normalizedFilename = filename == null ? "" : filename.toLowerCase();
        boolean extensionMatch = normalizedFilename.endsWith(".docx");
        boolean zipHeader = bytes.length >= 4 && bytes[0] == 'P' && bytes[1] == 'K';
        return extensionMatch || zipHeader;
    }

    private String filenameFromUrl(String cvUrl) {
        try {
            return Paths.get(URI.create(cvUrl).getPath()).getFileName().toString();
        } catch (Exception e) {
            return "";
        }
    }
}
