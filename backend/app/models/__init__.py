# Import all models so Base.metadata is fully populated for Alembic / create_all.
from app.models.base import TimestampMixin, utcnow  # noqa: F401
from app.models.user import (  # noqa: F401
    User, Role, Permission, role_permissions, user_roles,
    RefreshToken, NotificationPreference, DeliveryLog,
)
from app.models.patient import Patient, PatientInstruction  # noqa: F401
from app.models.screening import Screening, ScreeningResult  # noqa: F401
from app.models.case import FollowUpCase, CaseEvent, CASE_STATUS_ORDER  # noqa: F401
from app.models.referral import Referral  # noqa: F401
from app.models.appointment import Appointment  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.escalation import EscalationRule, EscalationLog  # noqa: F401
from app.models.audit import AuditLog, SystemSetting  # noqa: F401
