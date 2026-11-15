from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, DateTime, Boolean, Index
from sqlalchemy.orm import relationship

from app.models.base import TimestampMixin, utcnow
from app.core.database import Base

# Ordered workflow statuses (index matters for transition validation).
CASE_STATUS_ORDER = [
    "NEW_RESULT",
    "AWAITING_REVIEW",
    "PATIENT_NOTIFICATION_PENDING",
    "PATIENT_NOTIFIED",
    "AWAITING_CONFIRMATION",
    "REFERRAL_PENDING",
    "APPOINTMENT_PENDING",
    "CONSULTATION_COMPLETED",
    "TREATMENT_OR_SURVEILLANCE",
    "CLOSED",
]


class FollowUpCase(Base, TimestampMixin):
    __tablename__ = "follow_up_cases"
    __table_args__ = (
        Index("ix_cases_status_due_date", "status", "due_date"),
    )
    id = Column(Integer, primary_key=True, index=True)
    case_ref = Column(String(30), unique=True, nullable=False, index=True)  # FU-YYYY-NNNN
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    screening_id = Column(Integer, ForeignKey("screenings.id"), nullable=True, index=True)
    screening_type = Column(String(30), default="")
    result_classification = Column(String(20), default="")
    priority = Column(String(20), default="MEDIUM", index=True)  # Priority
    responsible_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String(40), default="NEW_RESULT", nullable=False, index=True)  # CaseStatus
    due_date = Column(Date, nullable=True, index=True)
    last_contact_at = Column(DateTime(timezone=True), nullable=True)
    next_action = Column(String(255), default="")
    closure_reason = Column(String(30), nullable=True)  # ClosureReason
    closed_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", back_populates="follow_up_cases")
    screening = relationship("Screening", back_populates="follow_up_case")
    events = relationship("CaseEvent", back_populates="case", cascade="all, delete-orphan", order_by="CaseEvent.created_at.asc()")
    referrals = relationship("Referral", back_populates="case")
    appointments = relationship("Appointment", back_populates="case")
    escalation_logs = relationship("EscalationLog", back_populates="case", cascade="all, delete-orphan")


class CaseEvent(Base):
    __tablename__ = "case_events"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("follow_up_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(40), nullable=False, index=True)  # CaseEventType
    note = Column(Text, default="")
    contact_outcome = Column(String(100), default="")
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    case = relationship("FollowUpCase", back_populates="events")
