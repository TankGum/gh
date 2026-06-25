from enum import StrEnum


class AppEnv(StrEnum):
    LOCAL = "local"
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"


class PermissionModule(StrEnum):
    OVERVIEW = "overview"
    BOOKINGS = "bookings"
    REVENUE = "revenue"
    STAFF = "staff"
    SHIFTS = "shifts"
    CUSTOMERS = "customers"
    BRANCHES = "branches"
    SERVICES = "services"
    RECRUIT = "recruit"
    ROLES = "roles"
    LOGS = "logs"


class PermissionAction(StrEnum):
    VIEW = "view"
    CREATE = "create"
    EDIT = "edit"
    DELETE = "delete"


class ServiceStatus(StrEnum):
    ACTIVE = "active"
    HIDDEN = "hidden"


class BranchStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"
    COMING_SOON = "coming_soon"


class AccountStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EmploymentStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class BookingStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ShiftType(StrEnum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    FULL_DAY = "full_day"
    OFF = "off"


class ActivityAction(StrEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"


FOUNDING_YEAR = 2024
HAPPY_CLIENTS = 120000
CONTACT_PHONE = "034 989 4039"

# Key của role quản trị viên (seed trong migration f896a4d51529).
