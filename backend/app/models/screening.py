from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.models.base import TimestampMixin, utcnow
from app.core.database import Base


class Screening(Base, TimestampMixin):
    __tablename__ = "screenings"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(30), nullable=False, index=True)  # ScreeningType
    screening_date = Column(Date, nullable=False, index=True)
    facility = Column(String(150), default="")
    performed_by = Column(String(150), default="")
    # Denormalized latest classification for query convenience.
    result_classification = Column(String(20), nullable=True, index=True)
    result_summary = Column(Text, default="")
    assigned_clinician_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    patient = relationship("Patient", back_populates="screenings")
    results = relationship("ScreeningResult", back_populates="screening", cascade="all, delete-orphan", order_by="ScreeningResult.recorded_at.desc()")
    follow_up_case = relationship("FollowUpCase", back_populates="screening", uselist=False)


class ScreeningResult(Base, TimestampMixin):
    __tablename__ = "screening_results"
    id = Column(Integer, primary_key=True, index=True)
    screening_id = Column(Integer, ForeignKey("screenings.id", ondelete="CASCADE"), nullable=False, index=True)
    result_classification = Column(String(20), nullable=False, index=True)  # ResultClassification
    result_summary = Column(Text, default="")
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    screening = relationship("Screening", back_populates="results")
