from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from agent_backend import get_agent
from integrations import get_jira_client, get_slack_client

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


# Routes
@app.get("/")
def root():
    return {"message": "GenVis API is running", "version": "1.0.0"}


@app.post("/api/ideate")
def ideate(request: IdeationRequest):
    try:
        agent = get_agent()
        result = agent.agent_ideate(request.industry, request.problem_area)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/requirements")
def requirements(request: RequirementsRequest):
    try:
        agent = get_agent()
        result = agent.agent_requirements(request.feature_name, request.target_persona)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/report")
def report(request: ReportingRequest):
    try:
        agent = get_agent()
        result = agent.agent_report(request.sprint_name, request.completed_items)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/jira/push")
def push_to_jira(user_stories: List[dict]):
    try:
        jira = get_jira_client()
        created = jira.bulk_create_stories(user_stories)
        return {"success": True, "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/slack/send")
def send_to_slack(sprint_report: dict):
    try:
        slack = get_slack_client()
        result = slack.send_sprint_summary(sprint_report)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    print("Starting GenVis API on http://localhost:8000")
    print("Docs available at http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
