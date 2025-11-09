import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent_backend import get_agent
from integrations import SLACK_CHANNEL, get_jira_client, get_slack_client

logger = logging.getLogger(__name__)
app = FastAPI(title="GenVis API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class IdeationRequest(BaseModel):
    industry: str
    problem_area: str

class RequirementsRequest(BaseModel):
    feature_name: str
    target_persona: str

class ReportingRequest(BaseModel):
    sprint_name: str
    completed_items: List[str]


# === Activity cache & helpers ===
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _count_items(value: Any) -> int:
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        return 1
    return 1 if value else 0


_activity_state: Dict[str, Dict[str, Any]] = {
    "jira": {
        "status": "connected",
        "last_sync": None,
        "new_stories": 0,
        "total_synced": 0,
        "completed_items": 0,
    },
    "slack": {
        "status": "ready",
        "channel": SLACK_CHANNEL or "#product-updates",
        "last_post": None,
        "last_summary": "",
    },
    "insights": {
        "status": "online",
        "updated_at": None,
        "pain_points": 0,
        "product_ideas": 0,
        "user_stories": 0,
    },
}


def _record_ideation_activity(payload: Dict[str, Any]) -> None:
    insights = _activity_state["insights"]
    insights["updated_at"] = _now_iso()
    insights["pain_points"] = _count_items(payload.get("pain_points"))
    insights["product_ideas"] = _count_items(payload.get("product_ideas"))


def _record_requirements_activity(payload: Dict[str, Any]) -> None:
    insights = _activity_state["insights"]
    insights["updated_at"] = _now_iso()
    insights["user_stories"] = _count_items(payload.get("user_stories"))


def _record_reporting_activity(completed_count: int) -> None:
    _activity_state["jira"]["completed_items"] = completed_count


def _record_jira_sync(created_count: int) -> None:
    jira = _activity_state["jira"]
    jira["last_sync"] = _now_iso()
    jira["new_stories"] = created_count
    jira["total_synced"] += created_count


def _record_slack_activity(summary: str) -> None:
    slack = _activity_state["slack"]
    slack["last_post"] = _now_iso()
    slack["last_summary"] = (summary or "")[:200]


# Routes
@app.get("/")
def root():
    return {"message": "GenVis API is running", "version": "1.0.0"}


@app.post("/api/ideate")
def ideate(request: IdeationRequest):
    try:
        agent = get_agent()
        result = agent.agent_ideate(request.industry, request.problem_area)
        _record_ideation_activity(result)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/requirements")
def requirements(request: RequirementsRequest):
    try:
        agent = get_agent()
        result = agent.agent_requirements(request.feature_name, request.target_persona)
        _record_requirements_activity(result)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/report")
def report(request: ReportingRequest):
    try:
        agent = get_agent()
        result = agent.agent_report(request.sprint_name, request.completed_items)
        _record_reporting_activity(len(request.completed_items or []))
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/jira/push")
def push_to_jira(user_stories: List[dict]):
    try:
        jira = get_jira_client()
        created = jira.bulk_create_stories(user_stories)
        _record_jira_sync(len(created))
        return {"success": True, "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/slack/send")
def send_to_slack(sprint_report: dict):
    try:
        slack = get_slack_client()
        result = slack.send_sprint_summary(sprint_report)
        summary = sprint_report.get("executive_summary") if isinstance(sprint_report, dict) else ""
        _record_slack_activity(summary or "")
        return {"success": True, "data": result}
    except Exception as e:
        logger.exception("Slack send failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/activity")
def get_activity():
    return {"success": True, "data": _activity_state}


if __name__ == "__main__":
    import uvicorn
    print("Starting GenVis API on http://localhost:8000")
    print("Docs available at http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
