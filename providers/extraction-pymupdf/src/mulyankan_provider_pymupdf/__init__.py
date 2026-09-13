"""Reference `extraction` provider built on PyMuPDF.

Bind it in `platform.yaml`:

    providers:
      extraction:
        provider: mulyankan_provider_pymupdf:PyMuPdfExtraction
"""

from mulyankan_provider_pymupdf.provider import PyMuPdfExtraction, PyMuPdfSession

__all__ = ["PyMuPdfExtraction", "PyMuPdfSession"]
