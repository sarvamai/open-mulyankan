"""Conformance suite for the `kms` SPI.

Checks the contract in `mulyankan_spi.kms`: descriptor completeness,
round-trip over Unicode and edge-size inputs, tamper detection, signature
determinism, and basic ciphertext sanity. Deliberately dependency-free so any
provider author can run it without installing the platform.
"""

from mulyankan_spi.descriptor import ProviderDescriptor
from mulyankan_spi.kms import KmsProvider

_CASES = [
    b"",
    b"a",
    "मूल्यांकन — evaluation ☺".encode(),
    bytes(range(256)) * 3,
]


def run_kms_conformance(provider: KmsProvider) -> list[str]:
    """Run the full suite against `provider`; returns failure messages."""
    failures: list[str] = []

    descriptor = provider.describe()
    if not isinstance(descriptor, ProviderDescriptor):
        failures.append("describe() must return a ProviderDescriptor")
        return failures
    if not descriptor.name:
        failures.append("describe().name must be non-empty")
    if not descriptor.version:
        failures.append("describe().version must be non-empty")
    if not descriptor.data_handling:
        failures.append("describe().data_handling must be a non-empty declaration")
    if not descriptor.deterministic:
        failures.append("kms providers must declare deterministic=True")

    key = "conformance-key"
    for plaintext in _CASES:
        ciphertext = provider.encrypt(key, plaintext)
        if ciphertext == plaintext and plaintext:
            failures.append(
                f"ciphertext equals plaintext for {len(plaintext)}-byte input"
            )
        try:
            recovered = provider.decrypt(key, ciphertext)
        except Exception as exc:  # noqa: BLE001 - suite reports, never raises
            failures.append(f"decrypt raised for {len(plaintext)}-byte input: {exc}")
            continue
        if recovered != plaintext:
            failures.append(f"round-trip failed for {len(plaintext)}-byte input")

    data = b"manifest-bytes-001"
    signature = provider.sign(key, data)
    if not provider.verify_signature(key, data, signature):
        failures.append("verify_signature(sign(data)) must be True")
    if provider.sign(key, data) != signature:
        failures.append("signing must be deterministic for the same key and input")
    if provider.verify_signature(key, data + b"x", signature):
        failures.append("verify_signature must reject tampered data")
    if provider.verify_signature(key + "-other", data, signature):
        failures.append("verify_signature must reject a different key")

    return failures
