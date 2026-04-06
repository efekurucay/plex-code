"""
formatter.py  –  Converts OpenAI-format messages + tool schemas into a plain-text
prompt for Perplexity, and parses Perplexity's text response back into tool_call
objects that CLI tools (OpenCode, Claude Code…) understand.
"""
import json, re, uuid
from typing import Any, List, Optional


TOOL_HEADER = """
== TOOL CALLING INSTRUCTIONS ==
You have access to the tools listed below.
When you need to use a tool, output ONLY this JSON block, nothing else around it:

```tool_call
{
  "name": "<tool_name>",
  "arguments": { ... }
}
```

I will show you the tool result, then you continue.
If you do NOT need a tool, answer normally in plain text.

== AVAILABLE TOOLS ==
"""


def _text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if not isinstance(item, dict):
                parts.append(str(item)); continue
            t = item.get("type")
            if t == "text":
                parts.append(item.get("text",""))
            elif t in ("tool_result", "tool_use"):
                inner = item.get("content") or item.get("input","")
                if isinstance(inner, list):
                    inner = " ".join(b.get("text","") for b in inner if isinstance(b,dict))
                parts.append(str(inner))
        return "\n".join(p for p in parts if p)
    return str(content)


def _schema_to_text(tool) -> str:
    fn = tool.function
    lines = [f"### {fn.name}"]
    if fn.description:
        lines.append(fn.description.strip())
    if fn.parameters:
        props = fn.parameters.get("properties", {})
        req   = fn.parameters.get("required", [])
        if props:
            lines.append("Parameters:")
            for pname, pdef in props.items():
                r     = " (required)" if pname in req else ""
                ptype = pdef.get("type","any")
                pdesc = pdef.get("description","")
                lines.append(f"  - {pname} ({ptype}{r}): {pdesc}")
    return "\n".join(lines)


def build_prompt(messages: list, tools: Optional[list]) -> str:
    parts = []

    if tools:
        docs = "\n\n".join(_schema_to_text(t) for t in tools)
        parts.append(TOOL_HEADER + docs)

    for msg in messages:
        role    = msg.role
        content = _text(msg.content)

        if role == "system":
            if content:
                parts.append(f"<system>\n{content}\n</system>")

        elif role == "user":
            if content:
                parts.append(f"**User:** {content}")

        elif role == "assistant":
            if msg.tool_calls:
                for tc in msg.tool_calls:
                    fn = tc.get("function", {})
                    try:
                        args = json.loads(fn.get("arguments","{}"))
                    except Exception:
                        args = fn.get("arguments","")
                    block = json.dumps({"name": fn.get("name"), "arguments": args}, indent=2)
                    parts.append(f"**Assistant (tool call):**\n```tool_call\n{block}\n```")
            elif content:
                parts.append(f"**Assistant:** {content}")

        elif role == "tool":
            tid = msg.tool_call_id or "?"
            parts.append(f"<tool_result id='{tid}'>\n{content}\n</tool_result>")

    return "\n\n".join(parts)


# ── Tool-call parsing ─────────────────────────────────────────────────────────

_FENCE_RE = re.compile(r"```(?:tool_call|json)\s*\n(\{.*?\})\s*\n```", re.DOTALL)
_XML_RE   = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>",          re.DOTALL)


def parse_tool_calls_from_text(text: str) -> list:
    raw = _FENCE_RE.findall(text) + _XML_RE.findall(text)
    calls = []
    for block in raw:
        try:
            parsed    = json.loads(block)
            name      = parsed.get("name") or parsed.get("tool","")
            arguments = parsed.get("arguments") or parsed.get("input") or {}
            if not name:
                continue
            calls.append({
                "id": f"call_{uuid.uuid4().hex[:8]}",
                "type": "function",
                "function": {"name": name, "arguments": arguments}
            })
        except json.JSONDecodeError:
            continue
    return calls
