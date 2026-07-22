from app.schemas.base import AppSchema


class PrintCertResponse(AppSchema):
    certificate: str


class PrintSignRequest(AppSchema):
    message: str


class PrintSignResponse(AppSchema):
    signature: str
