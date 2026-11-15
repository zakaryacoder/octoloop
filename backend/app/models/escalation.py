from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.models.base import TimestampMixin, utcnow
from app.core.database import Base


class EscalationRule(Base, TimestampMixin):
    __tablename__ = "escalation_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    # V2: multi-level escalation L1/L2/L3.
    level = Column(Integer, default=1, nullable=False)
    trigger_overdue_days = Column(Integer, default=3, nullable=False)
    escalate_to_role = Column(String(50), default="coordinator", nullable=False)
    notify_channel = Column(String(20), default="PORTAL")  # NotificationChannel
    logs = relationship("EscalationLog", back_populates="rule", cascade="all, delete-orphan")


class EscalationLog(Base):
    __tablename__ = "escalation_logs"
    # V2: idempotency per (case, rule, level, calendar day).
    __table_args__ = (
        UniqueConstraint("case_id", "rule_id", "level", "trigger_date", name="uq_escalation_case_rule_level_day"),
    )
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("follow_up_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(Integer, ForeignKey("escalation_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    level = Column(Integer, default=1, nullable=False)
    trigger_date = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    detail = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    case = relationship("FollowUpCase", back_populates="escalation_logs")
    rule = relationship("EscalationRule", back_populates="logs")
