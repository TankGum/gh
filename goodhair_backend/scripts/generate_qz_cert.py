"""Tạo cặp khoá RSA + chứng chỉ tự ký (self-signed) dùng để ký lệnh in QZ Tray.

Chạy 1 LẦN DUY NHẤT khi thiết lập tính năng in hoá đơn — chạy ngay trong môi
trường có sẵn thư viện `cryptography` (vd python3 hệ thống, hoặc bên trong
container backend: `docker compose exec backend python scripts/generate_qz_cert.py`):

    python3 scripts/generate_qz_cert.py
    # hoặc nếu có poetry: poetry run python scripts/generate_qz_cert.py

Sinh ra 2 file trong thư mục `certs/` (đã gitignore) — dùng ĐƯỜNG DẪN TƯƠNG
ĐỐI khi khai báo trong .env (certs/qz_private_key.pem) để chạy được cả local
lẫn trong container (xem QZ_PRIVATE_KEY_PATH trong .env.example):
  - qz_private_key.pem  -> đặt vào biến môi trường QZ_PRIVATE_KEY_PATH, GIỮ BÍ MẬT.
  - qz_certificate.pem  -> đặt vào biến môi trường QZ_CERTIFICATE_PATH, đây là phần
    public — cần import file này vào QZ Tray (Site Manager) trên máy tính tại quầy
    làm chứng chỉ "trusted" để in không hiện popup xác nhận mỗi lần.
"""

import datetime
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

OUT_DIR = Path(__file__).resolve().parent.parent / "certs"


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    key_path = OUT_DIR / "qz_private_key.pem"
    cert_path = OUT_DIR / "qz_certificate.pem"

    if key_path.exists() or cert_path.exists():
        print(f"Đã tồn tại {key_path} hoặc {cert_path} — xoá thủ công nếu muốn tạo lại.")
        return

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    subject = issuer = x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, "GoodHair QZ Tray Signing")]
    )
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(
            datetime.datetime.now(datetime.timezone.utc)
            + datetime.timedelta(days=3650)
        )
        .sign(private_key, hashes.SHA256())
    )

    key_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))

    print(f"Đã tạo:\n  {key_path}\n  {cert_path}")
    print(
        "\nTiếp theo:\n"
        f"  1. Thêm vào .env: QZ_PRIVATE_KEY_PATH={key_path}\n"
        f"                    QZ_CERTIFICATE_PATH={cert_path}\n"
        "  2. Mở QZ Tray trên máy tính tại quầy -> Advanced -> Site Manager\n"
        f"     -> import {cert_path.name} làm chứng chỉ trusted.\n"
    )


if __name__ == "__main__":
    main()
