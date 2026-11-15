from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship

from app.models.base import TimestampMixin, utcnow
from app.core.database import Base


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    audience = Column(String(20), nullable=False, index=True)  # NotificationAudience
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True, index=True)
    staff_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("follow_up_cases.id"), nullable=True, index=True)
    channel = Column(String(20), default="PORTAL")  # NotificationChannel
    status = Column(String(20), default="PENDING", nullable=False, index=True)  # NotificationStatus
    subject = Column(String(255), default="")
    message = Column(Text, default="")
    sent_at = Column(DateTime(timezone=True), default=utcnow, nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    case = relationship("FollowUpCase", foreign_keys=[case_id])
