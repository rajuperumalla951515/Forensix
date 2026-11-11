from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    investigator = "investigator"


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TransactionStatus(str, Enum):
    flagged = "flagged"
    cleared = "cleared"
    blocked = "blocked"
    pending = "pending"


class AlertSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AlertStatus(str, Enum):
    open = "open"
    investigating = "investigating"
    resolved = "resolved"
    dismissed = "dismissed"


class CaseStatus(str, Enum):
    open = "open"
    investigating = "investigating"
    pending_review = "pending_review"
    closed = "closed"
    escalated = "escalated"


class CustomerStatus(str, Enum):
    active = "active"
    suspended = "suspended"
    blocked = "blocked"
    under_review = "under_review"
