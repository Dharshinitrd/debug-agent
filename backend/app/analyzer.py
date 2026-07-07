"""
Core debugging-agent logic.
"""

import json
import os
import subprocess
import tempfile
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

MODEL = "gemini-2.5-flash"

SUPPORTED_LANGUAGES = {"python", "java", "cpp", "javascript"}


class DebugResult(BaseModel):
    error_detected: bool
    error_type: Optional[str] = None
    explanation: Optional[str] = None
    root_cause: Optional[str] = None
    corrected_code: Optional[str] = None
    debug_steps: list[str] = Field(default_factory=list)
    best_practices: list[str] = Field(default_factory=list)
    static_analysis_raw: Optional[str] = None


def run_static_analysis(code: str, language: str) -> Optional[str]:
    try:
        if language == "python":
            with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
                f.write(code)
                path = f.name
            result = subprocess.run(
                ["python", "-m", "pyflakes", path],
                capture_output=True, text=True, timeout=10,
            )
            return result.stdout.strip() or result.stderr.strip() or None

        if language == "javascript":
            with tempfile.NamedTemporaryFile(suffix=".js", mode="w", delete=False) as f:
                f.write(code)
                path = f.name
            result = subprocess.run(
                ["node", "--check", path],
                capture_output=True, text=True, timeout=10,
            )
            return result.stderr.strip() or None

        if language == "cpp":
            with tempfile.NamedTemporaryFile(suffix=".cpp", mode="w", delete=False) as f:
                f.write(code)
                path = f.name
            result = subprocess.run(
                ["g++", "-fsyntax-only", path],
                capture_output=True, text=True, timeout=15,
            )
            return result.stderr.strip() or None

        return None
    except (FileNotFoundError, subprocess.TimeoutExpired, subprocess.SubprocessError):
        return None


SYSTEM_PROMPT = """You are a debugging agent for Java, Python, C++, and JavaScript.
Given source code (and optional static-analysis output), respond with ONLY a
single JSON object, no markdown fences, no preamble, matching this schema:

{
  "error_detected": boolean,
  "error_type": string | null,
  "explanation": string | null,
  "root_cause": string | null,
  "corrected_code": string | null,
  "debug_steps": string[],
  "best_practices": string[]
}

If the code has no errors, set error_detected to false and still fill
best_practices with relevant suggestions if any apply. Be concise but specific.
"""


def analyze(code: str, language: str) -> DebugResult:
    language = language.lower()
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language: {language}")

    static_output = run_static_analysis(code, language)

    user_content = f"Language: {language}\n\nCode:\n```{language}\n{code}\n```"
    if static_output:
        user_content += f"\n\nStatic analysis tool output:\n{static_output}"

    response = client.models.generate_content(
        model=MODEL,
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
        ),
    )

    raw_text = response.text.strip()

    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text

    parsed = json.loads(raw_text)
    parsed["static_analysis_raw"] = static_output
    return DebugResult(**parsed)