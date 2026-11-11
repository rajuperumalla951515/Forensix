from sqlalchemy import Column, String, Float, Integer, DateTime, Enum, Index
from sqlalchemy.sql import func
from app.database.postgres import Base
from app.models.enums import (
    UserRole,
    RiskLevel,
    TransactionStatus,
    AlertSeverity,
    AlertStatus,
    CaseStatus,
    CustomerStatus,
)


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False)
    title = Column(String, nullable=False)
    initials = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)


class Customer(Base):
    __tablename__ = "customers"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    account_number = Column(String, nullable=False)
    risk_level = Column(Enum(RiskLevel, name="risk_level"), nullable=False, default=RiskLevel.low)
    risk_score = Column(Float, nullable=False, default=0)
    status = Column(Enum(CustomerStatus, name="customer_status"), nullable=False, default=CustomerStatus.active)
    total_transactions = Column(Integer, nullable=False, default=0)
    flagged_transactions = Column(Integer, nullable=False, default=0)
    country = Column(String, nullable=False, default="US")
    joined_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True)
    tx_hash = Column(String, nullable=False)
    from_account = Column(String, nullable=False)
    to_account = Column(String, nullable=False)
    from_customer_id = Column(String, nullable=False)
    to_customer_id = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="USD")
    status = Column(
        Enum(TransactionStatus, name="transaction_status"),
        nullable=False,
        default=TransactionStatus.pending,
    )
    risk_level = Column(Enum(RiskLevel, name="risk_level"), nullable=False, default=RiskLevel.low)
    risk_score = Column(Float, nullable=False, default=0)
    description = Column(String, nullable=False, default="")
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    country = Column(String, nullable=False, default="US")
    channel = Column(String, nullable=False, default="wire")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    severity = Column(Enum(AlertSeverity, name="alert_severity"), nullable=False, default=AlertSeverity.low)
    status = Column(Enum(AlertStatus, name="alert_status"), nullable=False, default=AlertStatus.open)
    transaction_id = Column(String, nullable=False)
    customer_id = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    rule_triggered = Column(String, nullable=False)


class FraudCase(Base):
    __tablename__ = "cases"
    id = Column(String, primary_key=True)
    case_number = Column(String, nullable=False)
    title = Column(String, nullable=False)
    status = Column(Enum(CaseStatus, name="case_status"), nullable=False, default=CaseStatus.open)
    priority = Column(Enum(RiskLevel, name="risk_level"), nullable=False, default=RiskLevel.medium)
    assignee = Column(String, nullable=False)
    customer_id = Column(String, nullable=False)
    customer_name = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False, default=0)
    transaction_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


Index("ix_transactions_timestamp", Transaction.timestamp)
Index("ix_transactions_status", Transaction.status)
Index("ix_transactions_risk_level", Transaction.risk_level)
Index("ix_alerts_timestamp", Alert.timestamp)
Index("ix_customers_risk_score", Customer.risk_score)
