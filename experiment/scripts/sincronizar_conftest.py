"""Copia tasks/<fase>/conftest_comum.py para os diretórios de testes de cada tarefa.

Uso: python experiment/scripts/sincronizar_conftest.py experiment/tasks/piloto
"""

import shutil
import sys
from pathlib import Path

raiz = Path(sys.argv[1])
fonte = raiz / "conftest_comum.py"
for pacote in sorted(p for p in raiz.iterdir() if (p / "task.toml").exists()):
    for sub in ("testes_publicos", "testes_ocultos"):
        destino = pacote / sub / "conftest.py"
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(fonte, destino)
        print(f"{destino}")
