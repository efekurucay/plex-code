"""
perplexity-proxy  ·  server.py
OpenAI-compatible API proxy that routes requests through Perplexity's web UI.
"""
import asyncio, json, re, time, uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from browser import PerplexityBrowser
from formatter import build_prompt, parse_tool_calls_from_text
from config import Config

cfg = Config()
pplx: Optional[PerplexityBrowser] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pplx
    pplx = PerplexityBrowser(cfg)
    await pplx.start()
    yield
    await pplx.stop()


app = FastAPI(title="perplexity-proxy", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Pydantic models ──────────────────────────────────────────────────────────

class FunctionDef(BaseModel):
    name: str
    description: Optional[str] = ""
    parameters: Optional[dict] = None

class ToolDef(BaseModel):
    type: str = "function"
    function: FunctionDef

class Message(BaseModel):
    role: str
    content: Optional[Any] = None
    tool_calls: Optional[List[dict]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None

class ChatRequest(BaseModel):
    model: str = "perplexity-web"
    messages: List[Message]
    tools: Optional[List[ToolDef]] = None
    stream: Optional[bool] = True
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None


# ── SSE helpers ───────────────────────────────────────────────────────────────

def _sse_chunk(rid, model, delta, finish=None):
    payload = {
        "id": rid, "object": "chat.completion.chunk",
        "created": int(time.time()), "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]
    }
    return f"data: {json.dumps(payload)}\n\n"


async def stream_text(text: str, model: str) -> AsyncGenerator[str, None]:
    rid = f"chatcmpl-{uuid.uuid4().hex[:8]}"
    yield _sse_chunk(rid, model, {"role": "assistant", "content": ""})
    for i in range(0, len(text), 12):
        yield _sse_chunk(rid, model, {"content": text[i:i+12]})
        await asyncio.sleep(0.008)
    yield _sse_chunk(rid, model, {}, "stop")
    yield "data: [DONE]\n\n"


async def stream_tool_calls(tool_calls, model):
    rid = f"chatcmpl-{uuid.uuid4().hex[:8]}"
    yield _sse_chunk(rid, model, {"role": "assistant", "content": None})
    for idx, tc in enumerate(tool_calls):
        fn = tc["function"]
        yield _sse_chunk(rid, model, {"tool_calls": [{
            "index": idx, "id": tc["id"], "type": "function",
            "function": {"name": fn["name"], "arguments": ""}
        }]})
        args_str = json.dumps(fn["arguments"])
        for i in range(0, len(args_str), 12):
            yield _sse_chunk(rid, model, {"tool_calls": [{"index": idx, "function": {"arguments": args_str[i:i+12]}}]})
            await asyncio.sleep(0.004)
    yield _sse_chunk(rid, model, {}, "tool_calls")
    yield "data: [DONE]\n\n"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok" if (pplx and pplx.ready) else "starting"}


@app.get("/v1/models")
async def list_models():
    return {"object": "list", "data": [
        {"id": "perplexity-web", "object": "model", "created": int(time.time()), "owned_by": "perplexity-proxy"}
    ]}


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatRequest):
    if not pplx or not pplx.ready:
        raise HTTPException(503, "Browser session not ready. Try /health.")

    prompt = build_prompt(req.messages, req.tools)
    raw = await pplx.ask(prompt)

    if req.tools:
        tool_calls = parse_tool_calls_from_text(raw)
        if tool_calls:
            if req.stream:
                return StreamingResponse(stream_tool_calls(tool_calls, req.model),
                    media_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
            return JSONResponse({
                "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
                "object": "chat.completion", "created": int(time.time()), "model": req.model,
                "choices": [{"index": 0, "message": {
                    "role": "assistant", "content": None, "tool_calls": tool_calls
                }, "finish_reason": "tool_calls"}],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            })

    if req.stream:
        return StreamingResponse(stream_text(raw, req.model),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
    return JSONResponse({
        "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
        "object": "chat.completion", "created": int(time.time()), "model": req.model,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": raw}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": len(prompt)//4, "completion_tokens": len(raw)//4, "total_tokens": (len(prompt)+len(raw))//4}
    })


# ── Anthropic shim (for Claude Code) ─────────────────────────────────────────
@app.post("/v1/messages")
async def anthropic_messages(request: Request):
    body = await request.json()
    messages = []
    for m in body.get("messages", []):
        content = m["content"]
        if isinstance(content, list):
            text = " ".join(b.get("text","") for b in content if b.get("type")=="text")
        else:
            text = content or ""
        messages.append(Message(role=m["role"], content=text))

    system = body.get("system", "")
    if system:
        messages.insert(0, Message(role="system", content=system))

    tools = [ToolDef(function=FunctionDef(
        name=t.get("name",""), description=t.get("description",""),
        parameters=t.get("input_schema")
    )) for t in body.get("tools", [])]

    req = ChatRequest(model=body.get("model","perplexity-web"),
                      messages=messages, tools=tools or None,
                      stream=body.get("stream", False))

    if not pplx or not pplx.ready:
        raise HTTPException(503, "Browser not ready")

    prompt = build_prompt(req.messages, req.tools)
    raw = await pplx.ask(prompt)
    tool_calls = parse_tool_calls_from_text(raw) if req.tools else []

    if tool_calls:
        content_blocks = [{"type":"tool_use","id":tc["id"],
                           "name":tc["function"]["name"],
                           "input":tc["function"]["arguments"]} for tc in tool_calls]
        stop_reason = "tool_use"
    else:
        content_blocks = [{"type":"text","text":raw}]
        stop_reason = "end_turn"

    return JSONResponse({
        "id": f"msg_{uuid.uuid4().hex[:8]}", "type": "message",
        "role": "assistant", "content": content_blocks,
        "model": req.model, "stop_reason": stop_reason, "stop_sequence": None,
        "usage": {"input_tokens": len(prompt)//4, "output_tokens": len(raw)//4}
    })
