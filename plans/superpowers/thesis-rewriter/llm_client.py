# llm_client.py
import os
import subprocess
import time
import warnings
from typing import Optional

ANTI_AI_SYSTEM_PROMPT = (
    "Bạn là một sinh viên năm cuối ngành Công nghệ Thông tin. Nhiệm vụ của bạn là viết nội dung "
    "cho báo cáo đồ án tốt nghiệp chuyên nghiệp nhưng mang tính con người cao nhất để vượt qua AI Detector.\n"
    "Quy tắc NGHIÊM NGẶT:\n"
    "- TUYỆT ĐỐI KHÔNG dùng dấu ngoặc kép (\"\") trong văn bản.\n"
    "- KHÔNG dùng từ ngữ khuôn mẫu AI: 'Nhìn chung', 'Tóm lại', 'Đáng chú ý', 'Trong bối cảnh'.\n"
    "- Tạo human burstiness: đan xen liên tục giữa câu đơn siêu ngắn (5-7 chữ) và câu ghép phức tạp.\n"
    "- Từ vựng kỹ thuật chính xác, nhưng văn phong trình bày mộc mạc, thực tế. Không lạm dụng tính từ mạnh.\n"
    "- Viết đoạn văn ngắn, dùng gạch đầu dòng để liệt kê, tuyệt đối không tạo các khối văn bản tường trình quá dài."
)

try:
    import anthropic
except ImportError:
    anthropic = None


class LLMClient:
    def __init__(self):
        if os.getenv("ANTHROPIC_API_KEY"):
            if anthropic is None:
                raise RuntimeError("ANTHROPIC_API_KEY set but 'anthropic' package not installed.")
            self.mode = "sdk"
            self._client = anthropic.Anthropic()
        else:
            self.mode = "subprocess"
            self._client = None

    def rewrite(self, user_prompt: str) -> Optional[str]:
        if self.mode == "subprocess":
            return self._call_subprocess(user_prompt)
        return self._call_sdk(user_prompt)

    def _call_subprocess(self, user_prompt: str) -> Optional[str]:
        full_prompt = f"{ANTI_AI_SYSTEM_PROMPT}\n\n{user_prompt}"
        try:
            result = subprocess.run(
                ["claude", "-p", full_prompt],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0 or not result.stdout.strip():
                warnings.warn(f"claude CLI failed: {result.stderr[:200]}")
                return None
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            warnings.warn("claude CLI timed out after 120s")
            return None
        except FileNotFoundError:
            raise RuntimeError(
                "'claude' CLI not found. Install Claude Code or set ANTHROPIC_API_KEY."
            )

    def _call_sdk(self, user_prompt: str, max_retries: int = 3) -> Optional[str]:
        for attempt in range(max_retries):
            try:
                response = self._client.messages.create(
                    model="claude-opus-4-8",
                    max_tokens=4096,
                    thinking={"type": "adaptive"},
                    system=ANTI_AI_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_prompt}],
                )
                for block in reversed(response.content):
                    if hasattr(block, "text"):
                        return block.text
                return None
            except anthropic.RateLimitError:
                wait = 2 ** attempt
                warnings.warn(f"Rate limit hit, retry in {wait}s")
                time.sleep(wait)
            except anthropic.APIError as e:
                warnings.warn(f"API error: {e}")
                return None
        warnings.warn("Max retries exceeded")
        return None
