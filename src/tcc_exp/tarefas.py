"""Pacotes de tarefa: leitura do manifesto, verificação de integridade e montagem do workspace.

Estrutura de um pacote (um diretório por tarefa):

    task.toml            manifesto (id, tipo, par, base, severidade e descrição dos testes ocultos)
    enunciado.md         texto entregue ao executor
    overrides/           arquivos que substituem os da aplicação-base (estado inicial da tarefa)
    testes_publicos/     testes copiados para o workspace
    testes_ocultos/      testes de avaliação, NUNCA copiados para o workspace
    referencia/          (opcional) arquivos da solução de referência, aplicados sobre o estado inicial
"""

from __future__ import annotations

import hashlib
import json
import shutil
import tomllib
from dataclasses import dataclass
from pathlib import Path

SEVERIDADES = ("critico", "maior", "menor")


class ErroTarefa(RuntimeError):
    pass


@dataclass(frozen=True)
class Tarefa:
    id: str
    tipo: str
    par: str
    titulo: str
    pacote: Path
    base: Path
    total_ocultos: int
    severidade: dict[str, str]
    descricao_ocultos: dict[str, str]
    piloto: bool

    @property
    def enunciado(self) -> Path:
        return self.pacote / "enunciado.md"

    @property
    def testes_publicos(self) -> Path:
        return self.pacote / "testes_publicos"

    @property
    def testes_ocultos(self) -> Path:
        return self.pacote / "testes_ocultos"

    @property
    def referencia(self) -> Path:
        return self.pacote / "referencia"


def carregar(diretorio_tarefas: Path, tarefa_id: str, base_dir: Path) -> Tarefa:
    pacote = diretorio_tarefas / tarefa_id
    manifesto = pacote / "task.toml"
    if not manifesto.exists():
        raise ErroTarefa(f"Manifesto não encontrado: {manifesto}")
    with open(manifesto, "rb") as f:
        m = tomllib.load(f)
    if m.get("id") != tarefa_id:
        raise ErroTarefa(f"id do manifesto ({m.get('id')}) difere do diretório ({tarefa_id})")
    severidade = m.get("severidade_ocultos", {})
    invalidas = {k: v for k, v in severidade.items() if v not in SEVERIDADES}
    if invalidas:
        raise ErroTarefa(f"Severidades inválidas em {tarefa_id}: {invalidas}")
    if len(severidade) != m["total_ocultos"]:
        raise ErroTarefa(
            f"{tarefa_id}: total_ocultos={m['total_ocultos']} mas há "
            f"{len(severidade)} severidades definidas"
        )
    descricoes = m.get("descricao_ocultos", {})
    if set(descricoes) != set(severidade):
        raise ErroTarefa(f"{tarefa_id}: cada teste oculto precisa de severidade E descrição")
    return Tarefa(
        id=m["id"],
        tipo=m["tipo"],
        par=m["par"],
        titulo=m["titulo"],
        pacote=pacote,
        base=(base_dir / m["base"]).resolve(),
        total_ocultos=int(m["total_ocultos"]),
        severidade=severidade,
        descricao_ocultos=descricoes,
        piloto=bool(m.get("piloto", False)),
    )


def hashes_pacote(pacote: Path) -> dict[str, str]:
    resultado = {}
    for arq in sorted(p for p in pacote.rglob("*") if p.is_file()):
        if "__pycache__" in arq.parts:
            continue
        resultado[arq.relative_to(pacote).as_posix()] = hashlib.sha256(arq.read_bytes()).hexdigest()
    return resultado


def ler_selos(arquivo: Path) -> dict[str, dict[str, str]]:
    return json.loads(arquivo.read_text(encoding="utf-8")) if arquivo.exists() else {}


def verificar_selo(pacote: Path, esperado: dict[str, str]) -> list[str]:
    """Compara os arquivos do pacote com os hashes registrados no congelamento do protocolo."""
    atual = hashes_pacote(pacote)
    problemas = []
    for nome in sorted(set(esperado) | set(atual)):
        if nome not in atual:
            problemas.append(f"ausente: {nome}")
        elif nome not in esperado:
            problemas.append(f"não selado: {nome}")
        elif esperado[nome] != atual[nome]:
            problemas.append(f"alterado: {nome}")
    return problemas


def _copiar_sobre(origem: Path, destino: Path) -> None:
    if not origem.exists():
        return
    for arq in origem.rglob("*"):
        if arq.is_file() and "__pycache__" not in arq.parts:
            alvo = destino / arq.relative_to(origem)
            alvo.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(arq, alvo)


def montar_workspace(tarefa: Tarefa, destino: Path, com_referencia: bool = False) -> None:
    """Copia a aplicação-base, aplica os overrides da tarefa e os testes públicos.

    Os testes ocultos nunca são copiados. `com_referencia=True` monta a solução de
    referência (usada só por `validar-tarefa`, nunca durante uma execução): os arquivos
    de `referencia/` são aplicados ao estado inicial. Sem esse diretório, a referência
    é a própria aplicação-base, ou seja, o estado inicial sem os overrides.
    """
    if destino.exists() and any(destino.iterdir()):
        raise ErroTarefa(f"Destino não está vazio: {destino}")
    ignorar = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", "tests")
    shutil.copytree(tarefa.base, destino, ignore=ignorar, dirs_exist_ok=True)
    if not com_referencia or tarefa.referencia.exists():
        _copiar_sobre(tarefa.pacote / "overrides", destino)
    if com_referencia:
        _copiar_sobre(tarefa.referencia, destino)
    _copiar_sobre(tarefa.testes_publicos, destino / "testes_publicos")
    shutil.copy2(tarefa.enunciado, destino / "ENUNCIADO.md")
