"""config.py – simple env-based config."""
import os

class Config:
    host: str = os.getenv("PROXY_HOST", "0.0.0.0")
    port: int = int(os.getenv("PROXY_PORT", "8080"))
    log_level: str = os.getenv("LOG_LEVEL", "info")
