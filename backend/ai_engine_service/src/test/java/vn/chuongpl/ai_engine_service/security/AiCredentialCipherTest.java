package vn.chuongpl.ai_engine_service.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiCredentialCipherTest {

    private static final String TEST_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";

    @Test
    void encrypt_then_decrypt_roundtrips() {
        AiCredentialCipher cipher = new AiCredentialCipher(TEST_KEY);

        String encrypted = cipher.encrypt("gsk_super_secret_key");

        assertThat(encrypted).startsWith("v1:").doesNotContain("gsk_super_secret_key");
        assertThat(cipher.decrypt(encrypted)).isEqualTo("gsk_super_secret_key");
    }

    @Test
    void decrypt_passes_through_legacy_plaintext_without_prefix() {
        AiCredentialCipher cipher = new AiCredentialCipher(TEST_KEY);

        assertThat(cipher.decrypt("plain-legacy-key")).isEqualTo("plain-legacy-key");
    }

    @Test
    void decrypt_returns_null_for_null_input() {
        AiCredentialCipher cipher = new AiCredentialCipher(TEST_KEY);

        assertThat(cipher.decrypt(null)).isNull();
    }

    @Test
    void encrypt_returns_blank_input_unchanged() {
        AiCredentialCipher cipher = new AiCredentialCipher(TEST_KEY);

        assertThat(cipher.encrypt("")).isEmpty();
        assertThat(cipher.encrypt(null)).isNull();
    }

    @Test
    void encrypt_without_configured_key_throws() {
        AiCredentialCipher cipher = new AiCredentialCipher("");

        assertThatThrownBy(() -> cipher.encrypt("secret"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void decrypt_without_configured_key_throws_for_encrypted_value() {
        AiCredentialCipher withKey = new AiCredentialCipher(TEST_KEY);
        String encrypted = withKey.encrypt("secret");
        AiCredentialCipher withoutKey = new AiCredentialCipher("");

        assertThatThrownBy(() -> withoutKey.decrypt(encrypted))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void decrypt_is_compatible_with_node_seed_script_encryption() {
        // Produced by: node -e crypto.createCipheriv('aes-256-gcm', key, iv) with the same
        // TEST_KEY and fixed IV, tag appended to ciphertext — see scripts/seed_master.mjs.
        AiCredentialCipher cipher = new AiCredentialCipher(TEST_KEY);
        String nodeEncryptedValue = "v1:BwcHBwcHBwcHBwcH:FScCPobKZqqjTP02V9TYRF65lLpS/QAQzdyz";

        assertThat(cipher.decrypt(nodeEncryptedValue)).isEqualTo("hello-world");
    }
}
