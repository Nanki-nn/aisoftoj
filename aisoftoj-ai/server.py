from __future__ import annotations

import uvicorn

from config import load_settings


def main() -> None:
    settings = load_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )


if __name__ == "__main__":
    main()
