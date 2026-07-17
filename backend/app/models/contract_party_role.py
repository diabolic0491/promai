from enum import StrEnum


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