"""
GenVis Agent Backend
Handles multi-step reasoning workflows for Product Manager tasks
"""

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

# load enviorment
load_dotenv()

# setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# nvidia config
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_API_BASE = os.getenv("NVIDIA_API_BASE", "https://integrate.api.nvidia.com/v1")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nvidia-nemotron-nano-9b-v2")


def _mock_ai_response(prompt: str) -> Dict[str, Any]:
    """Fallback response when real API is unavailable."""
    logger.warning("Falling back to mock AI response.")
    return {
        "content": f"[Mock AI Response based on: {prompt[:120]}...]",
        "reasoning_trace": [
            "Step 1: Analyzing user input and context",
            "Step 2: Breaking down task into subtasks",
            "Step 3: Generating structured output",
        ],
    }


def nemotron_generate(prompt: str, max_tokens: int = 1500) -> Dict[str, Any]:
    """Calls NVIDIA’s hosted LLM (Nemotron). Falls back if no key or network fails."""
    if not NVIDIA_API_KEY:
        return _mock_ai_response(prompt)

    url = f"{NVIDIA_API_BASE.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": "You are GenVis, an expert AI Product Manager."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=45)
        response.raise_for_status()
        data = response.json()
        message = data["choices"][0].get("message", {})

        raw_content = message.get("content", "")
        if isinstance(raw_content, list):
            content_parts = []
            for block in raw_content:
                if isinstance(block, dict):
                    if block.get("type") in {"output_text", "text"} and "text" in block:
                        content_parts.append(str(block["text"]))
                    elif "content" in block:
                        content_parts.append(str(block["content"]))
                elif isinstance(block, str):
                    content_parts.append(block)
            content = "".join(content_parts).strip()
        else:
            content = str(raw_content or "").strip()

        reasoning = []
        reasoning_payload = data["choices"][0].get("reasoning") or message.get("reasoning")
        if reasoning_payload is None and isinstance(raw_content, dict) and "reasoning" in raw_content:
            reasoning_payload = raw_content["reasoning"]
        if isinstance(reasoning_payload, list):
            reasoning = [str(step) for step in reasoning_payload if step]
        elif isinstance(reasoning_payload, str):
            reasoning = [reasoning_payload]

        return {
            "content": content,
            "reasoning_trace": reasoning or ["Model reasoning successful"],
        }
    except Exception as exc:
        logger.error("Nemotron API call failed: %s", exc)
        return _mock_ai_response(prompt)


CODE_FENCE_PATTERN = re.compile(r"```(?:json)?(.*?)```", re.DOTALL | re.IGNORECASE)
JSON_TAG_PATTERN = re.compile(r"<json>(.*?)</json>", re.DOTALL | re.IGNORECASE)


def _parse_structured_response(content: str) -> Optional[Dict[str, Any]]:
    """Best-effort JSON extraction from LLM output."""
    if not content:
        return None

    candidates = []
    stripped = content.strip()
    candidates.append(stripped)

    fence_match = CODE_FENCE_PATTERN.search(content)
    if fence_match:
        candidates.append(fence_match.group(1).strip())

    tag_match = JSON_TAG_PATTERN.search(content)
    if tag_match:
        candidates.append(tag_match.group(1).strip())

    # Extract balanced braces block
    start = -1
    depth = 0
    for idx, ch in enumerate(content):
        if ch == "{":
            if depth == 0:
                start = idx
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start != -1:
                    snippet = content[start : idx + 1]
                    candidates.append(snippet)
                    start = -1

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


# agent class
class GenVisAgent:
    """Main agent class managing workflows"""
    
    def __init__(self):
        self.state = {
            "session_id": datetime.now().strftime("%Y%m%d_%H%M%S"),
            "context": {},
            "history": []
        }
    
    def _update_state(self, workflow: str, data: Dict):
        self.state["context"][workflow] = data
        self.state["history"].append({
            "timestamp": datetime.now().isoformat(),
            "workflow": workflow,
            "data": data
        })
    
    # ideation agent
    def agent_ideate(self, industry: str, problem_area: str) -> Dict[str, Any]:
        prompt = f"""
You are GenVis, an AI Product Manager.
Respond with a single valid JSON object (no markdown, no commentary) containing:
- reasoning_trace: 5 detailed steps explaining how you approached the ideation (full sentences)
- pain_points: 5 richly written bullet strings (2–3 sentences each). Prefix each with its index like "1. ..."
- product_ideas: 5 objects with name, description (<= 420 chars, emphasize benefits), key_features (array of 4 strings), pain_points_addressed (array of indexes referencing pain_points, 1-indexed)
- personas: 3 objects with name, role, goals, frustrations, motivations, preferred_channels
- market_opportunity: object with tam, sam, som, cagr, strategic_insight (strings with context)
Write professional, persuasive copy. Context: industry="{industry}", problem_area="{problem_area}".
"""
        ai_response = nemotron_generate(prompt, max_tokens=2200)
        content = ai_response.get("content", "")
        structured = _parse_structured_response(content)

        if not structured:
            logger.error("Nemotron ideation response was not valid JSON. Raw content: %s", content)
            raise ValueError("Nemotron did not return valid JSON for ideation workflow.")

        self._update_state("ideation", structured)
        return structured
    
    # requirments agent
    def agent_requirements(self, feature_name: str, target_persona: str) -> Dict[str, Any]:
        prompt = f"""
You are GenVis generating requirements.
Respond with a single valid JSON object (no markdown, no commentary) for feature="{feature_name}" and persona="{target_persona}" including:
- reasoning_trace: 5 concise but descriptive steps (full sentences)
- user_stories: 4 stories each containing title, description (<= 280 chars), acceptance_criteria (array of 4 bullet sentences), story_points (number), dependencies (array up to 3 items), business_value (string), risks (string)
Keep content implementation-ready with clear detail.
"""
        ai_response = nemotron_generate(prompt, max_tokens=2000)
        content = ai_response.get("content", "")
        structured = _parse_structured_response(content)

        if not structured:
            logger.error("Nemotron requirements response was not valid JSON. Raw content: %s", content)
            raise ValueError("Nemotron did not return valid JSON for requirements workflow.")

        self._update_state("requirements", structured)
        return structured

    # reporting agent
    def agent_report(self, sprint_name: str, completed_items: List[str]) -> Dict[str, Any]:
        prompt = f"""
You are GenVis summarizing sprint work.
Respond with a single valid JSON object (no markdown, no commentary) for sprint="{sprint_name}" with items={json.dumps(completed_items)} including:
- reasoning_trace: 5 narrative steps describing the analysis performed
- executive_summary: up to 400 characters synthesizing outcomes and business impact
- metrics: object containing velocity, completion_rate, quality_score, customer_satisfaction, burndown_delta, scope_change
- achievements: 5 bullet strings (<= 200 chars each)
- blockers: up to 3 bullet strings (<= 180 chars)
- next_sprint_recommendations: 5 bullet strings (<= 200 chars) with clear actions
- stakeholder_updates: array of 3 strings highlighting how to message leadership, product, and engineering stakeholders
Keep language polished and data-driven.
"""
        ai_response = nemotron_generate(prompt, max_tokens=2200)
        content = ai_response.get("content", "")
        structured = _parse_structured_response(content)

        if not structured:
            logger.error("Nemotron reporting response was not valid JSON. Raw content: %s", content)
            raise ValueError("Nemotron did not return valid JSON for reporting workflow.")

        self._update_state("reporting", structured)
        return structured


# singleton helper
_agent_instance = None
def get_agent() -> GenVisAgent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = GenVisAgent()
    return _agent_instance
