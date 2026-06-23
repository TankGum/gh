from fastapi import APIRouter, Depends

from app.api.private.accounts.router import router as accounts_router
from app.api.private.bookings.router import router as bookings_router
from app.api.private.branches.router import router as branches_router
from app.api.private.customers.router import router as customers_router
from app.api.private.employee_shifts.router import router as employee_shifts_router
from app.api.private.employees.router import router as employees_router
from app.api.private.logs.router import router as logs_router
from app.api.private.overview.router import router as overview_router
from app.api.private.revenue.router import router as revenue_router
from app.api.private.roles.router import router as roles_router
from app.api.private.services.router import router as services_router
from app.api.public.auth.router import router as auth_router
from app.api.public.catalog.router import router as public_catalog_router
from app.api.public.health.router import router as health_router
from app.auth.dependencies import bind_actor

# Gắn actor (account_id + IP) vào context cho mọi request private để ghi nhật ký.
_private = [Depends(bind_actor)]

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(
    public_catalog_router, prefix="/public", tags=["Public"]
)
api_router.include_router(
    bookings_router, prefix="/bookings", tags=["Bookings"], dependencies=_private
)
api_router.include_router(
    customers_router, prefix="/customers", tags=["Customers"], dependencies=_private
)
api_router.include_router(
    overview_router, prefix="/overview", tags=["Overview"], dependencies=_private
)
api_router.include_router(
    services_router, prefix="/services", tags=["Services"], dependencies=_private
)
api_router.include_router(
    branches_router, prefix="/branches", tags=["Branches"], dependencies=_private
)
api_router.include_router(
    accounts_router, prefix="/accounts", tags=["Accounts"], dependencies=_private
)
api_router.include_router(
    roles_router, prefix="/roles", tags=["Roles"], dependencies=_private
)
api_router.include_router(
    employee_shifts_router, prefix="/shifts", tags=["Shifts"], dependencies=_private
)
api_router.include_router(
    employees_router, prefix="/employees", tags=["Employees"], dependencies=_private
)
api_router.include_router(
    revenue_router, prefix="/revenue", tags=["Revenue"], dependencies=_private
)
api_router.include_router(
    logs_router, prefix="/logs", tags=["Logs"], dependencies=_private
)
