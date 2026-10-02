#!/usr/bin/env bash
set -euo pipefail

python -m pip install -r requirements-dev.txt
python -m nuitka --standalone --enable-plugin=pyside6 --output-dir=build src/documentos_licitacao/__main__.py
