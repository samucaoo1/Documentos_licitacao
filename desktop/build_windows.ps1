$ErrorActionPreference = "Stop"

python -m pip install -r requirements-dev.txt
python -m nuitka --standalone --enable-plugin=pyside6 --windows-console-mode=disable --output-dir=build src/documentos_licitacao/__main__.py
