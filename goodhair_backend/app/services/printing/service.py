"""Ký & cấp chứng chỉ cho QZ Tray — cho phép in hoá đơn ra máy in nhiệt tại
quầy hoàn toàn im lặng (không hiện popup xác nhận mỗi lần in).

Xem scripts/generate_qz_cert.py để tạo cặp khoá lần đầu.
"""

import base64
from functools import lru_cache
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

from app.core.exceptions import BadRequestError
from app.core.settings import get_settings

def _not_configured() -> BadRequestError:
    return BadRequestError(
        message_key="errors.print.not_configured",
        detail={"message": "Chưa cấu hình QZ_PRIVATE_KEY_PATH/QZ_CERTIFICATE_PATH"},
    )


@lru_cache
def _load_private_key(path: str) -> RSAPrivateKey:
    key = serialization.load_pem_private_key(Path(path).read_bytes(), password=None)
    if not isinstance(key, RSAPrivateKey):
        raise BadRequestError(
            message_key="errors.print.invalid_key",
            detail={"message": "QZ_PRIVATE_KEY_PATH phải là khoá RSA"},
        )
    return key


def get_certificate_pem() -> str:
    path = get_settings().qz_certificate_path
    if not path:
        raise _not_configured()
    return Path(path).read_text()


def sign_message(message: str) -> str:
    path = get_settings().qz_private_key_path
    if not path:
        raise _not_configured()
    private_key = _load_private_key(path)
    signature = private_key.sign(message.encode("utf-8"), padding.PKCS1v15(), hashes.SHA512())
    return base64.b64encode(signature).decode("ascii")
