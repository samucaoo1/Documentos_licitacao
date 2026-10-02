from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication

from .main_window import MainWindow


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("Documentos de Licitação")
    app.setOrganizationName("DocumentosLicitacao")

    window = MainWindow()
    window.show()

    return app.exec()
