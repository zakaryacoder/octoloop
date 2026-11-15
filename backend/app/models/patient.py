from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.models.base import TimestampMixin, utcnow
from app.core.database import Base


class Patient(Base, TimestampMixin):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    mrn = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False, index=True)
    last_name = Column(String(100), nullable=False, index=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), default="")
    phone = Column(String(50), default="")
    email = Column(String(255), default="")
    address = Column(String(255), default="")
    primary_clinician_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    medical_history_summary = Column(Text, default="")
    allergies = Column(String(255), default="")
    screenings = relationship("Screening", back_populates="patient", cascade="all, delete-orphan")
    follow_up_cases = relationship("FollowUpCase", back_populates="patient", cascade="all, delete-orphan")
    referrals = relationship("Referral", back_populates="patient", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    instructions = relationship("PatientInstruction", back_populates="patient", cascade="all, delete-orphan")


class PatientInstruction(Base, TimestampMixin):
    """Staff-entered, patient-facing instructions (read-only in portal). No internal notes."""
    __tablename__ = "patient_instructions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    instruction = Column(Text, nullable=False)
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    patient = relationship("Patient", back_populates="instructions")
