# tests/test_llm_client.py
import os
import warnings
from unittest.mock import MagicMock, patch
import pytest
from llm_client import LLMClient, ANTI_AI_SYSTEM_PROMPT


# ── Subprocess mode ──────────────────────────────────────────────────────────

def test_subprocess_mode_selected_when_no_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    client = LLMClient()
    assert client.mode == "subprocess"


def test_subprocess_returns_stdout(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    mock_result = MagicMock(returncode=0, stdout="rewritten text\n", stderr="")
    with patch("llm_client.subprocess.run", return_value=mock_result) as mock_run:
        client = LLMClient()
        result = client.rewrite("write something")
    assert result == "rewritten text"
    # Verify system prompt is embedded in the call
    call_args = mock_run.call_args
    prompt_sent = call_args[0][0][2]  # ['claude', '-p', <prompt>]
    assert ANTI_AI_SYSTEM_PROMPT[:50] in prompt_sent


def test_subprocess_returns_none_on_nonzero_exit(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    mock_result = MagicMock(returncode=1, stdout="", stderr="some error")
    with patch("llm_client.subprocess.run", return_value=mock_result):
        client = LLMClient()
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            result = client.rewrite("prompt")
    assert result is None
    assert any("failed" in str(warning.message).lower() for warning in w)


def test_subprocess_returns_none_on_timeout(monkeypatch):
    import subprocess
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with patch("llm_client.subprocess.run", side_effect=subprocess.TimeoutExpired("claude", 120)):
        client = LLMClient()
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            result = client.rewrite("prompt")
    assert result is None
    assert any("timed out" in str(warning.message).lower() for warning in w)


def test_subprocess_raises_when_claude_not_installed(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with patch("llm_client.subprocess.run", side_effect=FileNotFoundError()):
        client = LLMClient()
        with pytest.raises(RuntimeError, match="'claude' CLI not found"):
            client.rewrite("prompt")


# ── SDK mode ─────────────────────────────────────────────────────────────────

def test_sdk_mode_selected_when_api_key_set(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    with patch("llm_client.anthropic"):
        client = LLMClient()
    assert client.mode == "sdk"


def test_sdk_returns_text_from_response(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    mock_block = MagicMock()
    mock_block.text = "sdk response text"
    mock_response = MagicMock(content=[mock_block])
    mock_anthropic = MagicMock()
    mock_anthropic.Anthropic.return_value.messages.create.return_value = mock_response
    with patch("llm_client.anthropic", mock_anthropic):
        client = LLMClient()
        result = client.rewrite("write something")
    assert result == "sdk response text"


def test_sdk_retries_on_rate_limit(monkeypatch):
    import anthropic as real_anthropic
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    mock_block = MagicMock()
    mock_block.text = "ok after retry"
    mock_response = MagicMock(content=[mock_block])
    mock_anthropic = MagicMock()
    mock_create = mock_anthropic.Anthropic.return_value.messages.create

    # Use a subclass trick to create a raiseable RateLimitError without a real response
    class FakeRateLimitError(real_anthropic.RateLimitError):
        def __init__(self):
            pass  # Skip parent __init__ that requires response/body

    mock_create.side_effect = [
        FakeRateLimitError(),
        mock_response,
    ]
    mock_anthropic.RateLimitError = real_anthropic.RateLimitError
    mock_anthropic.APIError = real_anthropic.APIError
    with patch("llm_client.anthropic", mock_anthropic):
        with patch("llm_client.time.sleep"):
            client = LLMClient()
            result = client.rewrite("prompt")
    assert result == "ok after retry"
    assert mock_create.call_count == 2


def test_sdk_returns_none_on_api_error(monkeypatch):
    import anthropic as real_anthropic
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    mock_anthropic = MagicMock()
    mock_create = mock_anthropic.Anthropic.return_value.messages.create

    class FakeAPIError(real_anthropic.APIError):
        def __init__(self):
            pass  # Skip parent __init__

    mock_create.side_effect = FakeAPIError()
    mock_anthropic.RateLimitError = real_anthropic.RateLimitError
    mock_anthropic.APIError = real_anthropic.APIError
    with patch("llm_client.anthropic", mock_anthropic):
        client = LLMClient()
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            result = client.rewrite("prompt")
    assert result is None
