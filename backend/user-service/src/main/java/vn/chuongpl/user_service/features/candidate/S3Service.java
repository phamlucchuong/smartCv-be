package vn.chuongpl.user_service.features.candidate;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;

import java.time.Duration;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3Service {

    public record CvUploadResult(String s3Key, String url) {}

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${AWS_S3_BUCKET_NAME:smartcv-cvs}")
    String bucket;

    @Value("${AWS_REGION:ap-southeast-1}")
    String region;

    @Value("${AWS_S3_ENDPOINT_URL:}")
    String endpointUrl;

    @Value("${AWS_S3_PRESIGNED_URL_TTL_MINUTES:60}")
    int presignedUrlTtl;

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024;
    private static final long MAX_AVATAR_SIZE = 2 * 1024 * 1024;
    private static final long MAX_LICENSE_SIZE = 10 * 1024 * 1024;
    private static final String ALLOWED_CONTENT_TYPE = "application/pdf";
    private static final java.util.Set<String> ALLOWED_IMAGE_TYPES = java.util.Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    );
    private static final java.util.Set<String> ALLOWED_LICENSE_TYPES = java.util.Set.of(
            "application/pdf", "image/jpeg", "image/jpg", "image/png"
    );

    public String uploadAvatar(MultipartFile file, String userId) {
        validateAvatarFile(file);

        String originalFilename = file.getOriginalFilename();
        String ext = (originalFilename != null && originalFilename.contains("."))
                ? originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase()
                : "jpg";
        String key = "avatars/" + userId + "/" + UUID.randomUUID() + "." + ext;

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(file.getContentType())
                            .build(),
                    RequestBody.fromBytes(file.getBytes())
            );
        } catch (Exception e) {
            log.error("S3 avatar upload failed: {}", e.getMessage());
            throw new AppException(vn.chuongpl.user_service.enums.ErrorCode.FILE_UPLOAD_FAILED);
        }

        // For local MinIO, return a presigned URL. For real AWS, return the permanent path-style URL.
        // The bucket must have a public-read bucket policy (not object ACL) for this URL to be accessible.
        if (!endpointUrl.isBlank()) {
            return generatePresignedUrl(key);
        }
        return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
    }

    public void deleteAvatar(String avatarUrl) {
        if (avatarUrl == null || avatarUrl.isBlank()) {
            return;
        }
        int idx = avatarUrl.indexOf("avatars/");
        if (idx == -1) {
            return;
        }
        String key = avatarUrl.substring(idx);
        if (key.contains("?")) {
            key = key.substring(0, key.indexOf("?"));
        }
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build());
            log.info("Successfully deleted old avatar from S3: key={}", key);
        } catch (Exception e) {
            log.error("Failed to delete old avatar from S3: key={}, error={}", key, e.getMessage());
        }
    }

    public CvUploadResult uploadCv(MultipartFile file, String candidateId) {
        validateFile(file);

        String key = "cvs/" + candidateId + "/" + UUID.randomUUID() + ".pdf";

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(ALLOWED_CONTENT_TYPE)
                            .build(),
                    RequestBody.fromBytes(file.getBytes())
            );
        } catch (Exception e) {
            log.error("S3 upload failed: {}", e.getMessage());
            throw new AppException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        String url = generateFreshUrl(key);
        return new CvUploadResult(key, url);
    }

    public String generateFreshUrl(String key) {
        return generatePresignedUrl(key);
    }

    public String generatePresignedUrl(String key) {
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(presignedUrlTtl))
                .getObjectRequest(r -> r.bucket(bucket).key(key).build())
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    public String uploadBusinessLicense(MultipartFile file, String userId) {
        if (file == null || file.isEmpty()) throw new AppException(ErrorCode.FILE_REQUIRED);
        if (file.getSize() > MAX_LICENSE_SIZE) throw new AppException(ErrorCode.FILE_TOO_LARGE);
        if (!ALLOWED_LICENSE_TYPES.contains(file.getContentType())) throw new AppException(ErrorCode.INVALID_FILE_TYPE);

        String key = "recruiters/" + userId + "/business-license";

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(file.getContentType())
                            .build(),
                    RequestBody.fromBytes(file.getBytes())
            );
        } catch (Exception e) {
            log.error("S3 business-license upload failed: {}", e.getMessage());
            throw new AppException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        if (!endpointUrl.isBlank()) {
            return generatePresignedUrl(key);
        }
        return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.FILE_REQUIRED);
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new AppException(ErrorCode.FILE_TOO_LARGE);
        }
        if (!ALLOWED_CONTENT_TYPE.equals(file.getContentType())) {
            throw new AppException(ErrorCode.INVALID_FILE_TYPE);
        }
    }

    private void validateAvatarFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.FILE_REQUIRED);
        }
        if (file.getSize() > MAX_AVATAR_SIZE) {
            throw new AppException(ErrorCode.IMAGE_TOO_LARGE);
        }
        if (!ALLOWED_IMAGE_TYPES.contains(file.getContentType())) {
            throw new AppException(ErrorCode.INVALID_IMAGE_TYPE);
        }
    }
}
