import sys

from loguru import logger

from app.core.settings import Settings


def configure_logging(settings: Settings) -> None:
    logger.remove()
    logger.add(
        sys.stderr,
        level="DEBUG" if settings.debug else "INFO",
        backtrace=settings.debug,
        diagnose=settings.debug,
    )
