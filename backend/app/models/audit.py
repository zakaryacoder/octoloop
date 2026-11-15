from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime

from app.models.base import utcnow
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String(50), default="")
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), default="")
    entity_id = Column(Integer, nullable=True)
    ip_address = Column(String(50), default="")
    details = Column(Text, default="")


class SystemSetting(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
