from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.exceptions import UnauthorizedError
from app.core.settings import get_settings


def verify_google_id_token(token: str) -> dict[str, str | None]:
    settings = get_settings()
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except (GoogleAuthError, ValueError) as exc:
        raise UnauthorizedError(message_key="errors.auth.invalid_google_token") from exc
    return {
        "google_id": idinfo["sub"],
        "email": idinfo["email"],
        "name": idinfo.get("name", idinfo["email"].split("@")[0]),
        "avatar_url": idinfo.get("picture"),
    }
