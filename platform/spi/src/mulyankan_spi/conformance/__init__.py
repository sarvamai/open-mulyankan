"""Conformance suites: the certification gate for providers (ADR-0003, rule 4).

Each suite is a plain function returning a list of failure strings; an empty
list means the provider conforms. CI runs every in-repo provider against its
suite, and external providers publish their results.
"""

from mulyankan_spi.conformance.kms import run_kms_conformance

__all__ = ["run_kms_conformance"]
