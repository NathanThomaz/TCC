"""Registro de eventos em JSONL somente-acréscimo, com encadeamento por hash.

Cada linha guarda o SHA-256 da linha anterior. Qualquer edição posterior do
arquivo quebra a cadeia, e `verificar_cadeia` detecta a alteração.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

HASH_INICIAL = "0" * 64

TIPOS = {
    "abertura",          # enunciado exibido ao executor
    "inicio",            # executor terminou a leitura e começou a trabalhar
    "pausa",
    "retomada",
    "teste_publico",     # execução dos testes públicos
    "entrega",           # executor declara a solução pronta
    "avaliacao",         # resultado dos testes ocultos para a entrega
    "devolutiva",        # relatório de defeitos entregue ao executor
    "fim",               # execução encerrada (aceita, rejeitada ou limite)
    "aborto",            # execução interrompida por falha de ambiente/API
    "nota",              # observação livre do executor
    "analise_estatica",
    "metadados_ia",
    "anexo",             # transcrição ou outro arquivo bruto anexado
    "percepcao",         # estimativa do executor sobre o próprio tempo
}


class ErroEvento(RuntimeError):
    pass


def agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def _hash(linha: str) -> str:
    return hashlib.sha256(linha.encode("utf-8")).hexdigest()


def ler(arquivo: Path) -> list[dict]:
    if not arquivo.exists():
        return []
    return [json.loads(l) for l in arquivo.read_text(encoding="utf-8").splitlines() if l.strip()]


def registrar(
    arquivo: Path,
    exec_id: str,
    tipo: str,
    payload: dict | None = None,
    agora: datetime | None = None,
) -> dict:
    if tipo not in TIPOS:
        raise ErroEvento(f"Tipo de evento desconhecido: {tipo!r}")
    linhas = arquivo.read_text(encoding="utf-8").splitlines() if arquivo.exists() else []
    linhas = [l for l in linhas if l.strip()]
    evento = {
        "seq": len(linhas) + 1,
        "ts": (agora or agora_utc()).isoformat(),
        "exec_id": exec_id,
        "tipo": tipo,
        "payload": payload or {},
        "hash_anterior": _hash(linhas[-1]) if linhas else HASH_INICIAL,
    }
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    with open(arquivo, "a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(evento, ensure_ascii=False, sort_keys=True) + "\n")
    return evento


def verificar_cadeia(arquivo: Path) -> list[str]:
    """Retorna a lista de problemas encontrados (vazia se o arquivo estiver íntegro)."""
    problemas = []
    anterior = None
    linhas = [l for l in arquivo.read_text(encoding="utf-8").splitlines() if l.strip()]
    for i, linha in enumerate(linhas, start=1):
        ev = json.loads(linha)
        esperado = _hash(anterior) if anterior is not None else HASH_INICIAL
        if ev.get("hash_anterior") != esperado:
            problemas.append(f"linha {i}: hash_anterior não confere (arquivo alterado?)")
        if ev.get("seq") != i:
            problemas.append(f"linha {i}: seq={ev.get('seq')} fora de ordem")
        anterior = linha
    return problemas


def ts(evento: dict) -> datetime:
    return datetime.fromisoformat(evento["ts"])
