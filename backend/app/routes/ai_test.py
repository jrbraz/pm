import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.ai_client import chat_completion
from app.deps import get_current_user
from app.errors import error_payload

router = APIRouter(prefix="/api")


@router.post("/ai/test")
def ai_test(payload: dict, current_user: dict = Depends(get_current_user)) -> dict:
    prompt = payload.get("prompt", "What is 2+2? Reply with just the number.")
    try:
        result = chat_completion(
            messages=[{"role": "user", "content": prompt}]
        )
        return {"result": result}
    except (httpx.HTTPStatusError, RuntimeError) as exc:
        return JSONResponse(
            status_code=502,
            content=error_payload("AI_ERROR", str(exc)),
        )
