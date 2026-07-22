from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_account_id
from app.schemas.print import PrintCertResponse, PrintSignRequest, PrintSignResponse
from app.services.printing.service import get_certificate_pem, sign_message

router = APIRouter()


@router.get("/cert", response_model=PrintCertResponse)
async def get_print_certificate(
    _: UUID = Depends(get_current_account_id),
) -> PrintCertResponse:
    """QZ Tray gọi để lấy chứng chỉ public — chỉ cần đăng nhập, không cần
    quyền riêng vì không lộ thông tin nhạy cảm."""
    return PrintCertResponse(certificate=get_certificate_pem())


@router.post("/sign", response_model=PrintSignResponse)
async def sign_print_request(
    payload: PrintSignRequest,
    _: UUID = Depends(get_current_account_id),
) -> PrintSignResponse:
    """Ký nội dung QZ Tray yêu cầu bằng khoá riêng lưu ở backend — để in hoá
    đơn tự động, không hiện popup xác nhận mỗi lần."""
    return PrintSignResponse(signature=sign_message(payload.message))
