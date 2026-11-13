from pydantic import BaseModel
from typing import Literal

class ToolRunRequest(BaseModel):
    tool: str

class SearchRequest(BaseModel):
    query: str
    limit: int = 100
    scope: Literal["game", "all"] = "game"

class NativeAnalysisRequest(BaseModel):
    types: list[str] = []
