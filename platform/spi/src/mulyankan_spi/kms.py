"""KMS SPI: key-managed encryption, decryption, and signing.

Consumers: the sealing worker (QST05-VLT-04) and the export profile.

Determinism contract for this SPI: signatures are deterministic for a given
key and input, and `decrypt(encrypt(p)) == p` always holds. Encryption may
freshen its nonce per call — ciphertext bytes need not be identical across
calls, but every ciphertext must decrypt correctly for the lifetime of the
key. Production providers implement this over KMIP/PKCS#11 or a cloud KMS;
the reference `kms-local` provider is for development only.
"""

from typing import Protocol, runtime_checkable

from mulyankan_spi.descriptor import ProviderDescriptor


@runtime_checkable
class KmsProvider(Protocol):
    """Key management behind managed keys; never embeds secrets in the core."""

    def describe(self) -> ProviderDescriptor:
        """Return the provider descriptor (name, version, data handling)."""
        ...

    def encrypt(self, key_id: str, plaintext: bytes) -> bytes:
        """Encrypt `plaintext` under `key_id`; returns nonce||ciphertext."""
        ...

    def decrypt(self, key_id: str, ciphertext: bytes) -> bytes:
        """Decrypt `ciphertext` under `key_id`; raises on tamper or wrong key."""
        ...

    def sign(self, key_id: str, data: bytes) -> bytes:
        """Produce a deterministic signature over `data` under `key_id`."""
        ...

    def verify_signature(self, key_id: str, data: bytes, signature: bytes) -> bool:
        """Verify `signature` over `data` under `key_id`."""
        ...
