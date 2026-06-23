from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.exception_handlers import register_exception_handlers
from app.core.logger import configure_logging
from app.core.settings import get_settings
from app.middlewares.access_log import AccessLogMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings)

    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )

    configure_middleware(app)
    register_exception_handlers(app)
    configure_static(app)
    configure_router(app)

    return app


def configure_static(app: FastAPI) -> None:
    settings = get_settings()
    upload_path = Path(settings.upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    app.mount(
        settings.static_url_path,
        StaticFiles(directory=upload_path),
        name="static",
    )


def configure_middleware(app: FastAPI) -> None:
    settings = get_settings()
    # CORSMiddleware là outermost để xử lý preflight OPTIONS trước các middleware khác.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(AccessLogMiddleware)


def configure_router(app: FastAPI) -> None:
    settings = get_settings()
    app.include_router(api_router, prefix=settings.api_v1_prefix)
