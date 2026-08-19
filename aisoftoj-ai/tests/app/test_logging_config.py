from __future__ import annotations

import logging

from app.logging_config import APPLICATION_LOGGER_NAME, configure_application_logging


class CaptureHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


def test_application_logger_reuses_uvicorn_handlers_without_duplicates() -> None:
    app_logger = logging.getLogger(APPLICATION_LOGGER_NAME)
    uvicorn_logger = logging.getLogger("uvicorn.error")
    original_app_handlers = list(app_logger.handlers)
    original_uvicorn_handlers = list(uvicorn_logger.handlers)
    original_level = app_logger.level
    original_propagate = app_logger.propagate
    capture = CaptureHandler()
    try:
        uvicorn_logger.handlers = [capture]
        configure_application_logging("info")
        configure_application_logging("info")
        logging.getLogger(f"{APPLICATION_LOGGER_NAME}.test").info("visible")

        assert app_logger.handlers == [capture]
        assert app_logger.level == logging.INFO
        assert app_logger.propagate is False
        assert [record.getMessage() for record in capture.records] == ["visible"]
    finally:
        app_logger.handlers = original_app_handlers
        app_logger.setLevel(original_level)
        app_logger.propagate = original_propagate
        uvicorn_logger.handlers = original_uvicorn_handlers
