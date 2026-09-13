# open-mulyankan — the commands from AGENTS.md, executable.
# `make help` is the default target: it lists everything below.

.DEFAULT_GOAL := help
SHELL := /bin/sh

VENV := .venv
PYTHON := $(VENV)/bin/python
PIP_FLAGS := --quiet

.PHONY: help install test lint format run-api run-admin clean

help: ## List every target
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Create .venv and install spi, core[dev], provider[dev]
	uv venv $(VENV)
	uv pip install $(PIP_FLAGS) -e platform/spi \
		-e "platform/core[dev]" \
		-e "providers/extraction-pymupdf[dev]"

test: ## Run the full Python suite (spi, core, providers)
	$(PYTHON) -m pytest platform providers -q

lint: ## ruff check over platform and providers
	$(PYTHON) -m ruff check platform providers

format: ## ruff format over platform and providers
	$(PYTHON) -m ruff format platform providers

run-api: ## core-api on :8000 (cp platform.yaml.example platform.yaml first, or none)
	$(PYTHON) -m uvicorn mulyankan_platform.core_api.main:app --port 8000

run-admin: ## apps/web dev server on :3000 (pnpm install first)
	cd apps/web && pnpm dev

clean: ## Remove the venv and Python caches
	rm -rf $(VENV) .pytest_cache .ruff_cache
	find . -name '__pycache__' -type d -not -path './apps/*' -exec rm -rf {} +
