from __future__ import annotations

import logging
import sys

APPLICATION_LOGGER_NAME = "packages.harness.aisoftoj_agent"
_FALLBACK_HANDLER_MARKER = "_aisoftoj_application_handler"


def configure_application_logging(level: str) -> logging.Logger:
    logger = logging.getLogger(APPLICATION_LOGGER_NAME)
    logger.setLevel(level.upper())
    logger.propagate = False

    uvicorn_handlers = logging.getLogger("uvicorn.error").handlers
    if uvicorn_handlers:
        logger.handlers = list(uvicorn_handlers)
        return logger

    if not any(getattr(handler, _FALLBACK_HANDLER_MARKER, False) for handler in logger.handlers):
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
        setattr(handler, _FALLBACK_HANDLER_MARKER, True)
        logger.addHandler(handler)
    return logger
