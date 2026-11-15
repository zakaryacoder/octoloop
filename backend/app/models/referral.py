from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.models.base import TimestampMixin
from app.core.database import Base


class Referral(Base, TimestampMixin):
    __tablename__ = "referrals"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("follow_up_cases.id"), nullable=True, index=True)
    from_department = Column(String(100), default="")
    to_department = Column(String(100), nullable=False)
    reason = Column(Text, default="")
    status = Column(String(20), default="DRAFT", nullable=False, index=True)  # ReferralStatus
    sent_at = Column(DateTime(timezone=True), nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, default="")

    patient = relationship("Patient", back_populates="referrals")
    case = relationship("FollowUpCase", back_populates="referrals")
