"""mulyankan-spi: provider interfaces and conformance suites.

Providers implement these Protocols in their own packages and depend only on
this distribution — never on the platform core (ADR-0003).
"""

from mulyankan_spi.descriptor import ProviderDescriptor
from mulyankan_spi.kms import KmsProvider

__version__ = "0.1.0"

__all__ = ["KmsProvider", "ProviderDescriptor", "__version__"]
