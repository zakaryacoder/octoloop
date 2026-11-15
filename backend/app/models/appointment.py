from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.models.base import TimestampMixin
from app.core.database import Base


class Appointment(Base, TimestampMixin):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("follow_up_cases.id"), nullable=True, index=True)
    referral_id = Column(Integer, ForeignKey("referrals.id"), nullable=True, index=True)
    department = Column(String(100), default="")
    clinician_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_min = Column(Integer, default=30)
    status = Column(String(20), default="SCHEDULED", nullable=False, index=True)  # AppointmentStatus
    notes = Column(Text, default="")
    attended_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", back_populates="appointments")
    case = relationship("FollowUpCase", back_populates="appointments")
