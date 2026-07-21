from enum import StrEnum


class ContractStatus(StrEnum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    COMPLETED = "completed"
    TERMINATED = "terminated"


class ContractPartyRole(StrEnum):
    SUPPLIER = "supplier"
    BUYER = "buyer"
    CONTRACTOR = "contractor"
    CUSTOMER = "customer"
    EXECUTOR = "executor"
    LANDLORD = "landlord"
    TENANT = "tenant"
    LENDER = "lender"
    BORROWER = "borrower"
    OTHER = "other"