"""Formato dos erros, ordenação, camada estrutural, linha de comando e ausência de eval/exec."""

from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from forja.erros import CATALOGO, ErroValidacao, novo, ordenar, ponteiro
from forja.validacao import validar, validar_arquivo

from .conftest import EXEMPLO_PADARIA, RAIZ, validar_e_conferir

SRC_FORJA = RAIZ / "src" / "forja"


def test_catalogo_bem_formado():
    assert CATALOGO and all(sev in ("erro", "aviso") and desc for sev, desc in CATALOGO.values())


def test_codigo_fora_do_catalogo_e_recusado():
    with pytest.raises(KeyError):
        novo("CODIGO_INVENTADO", "", "x")


def test_estrutura_do_erro_e_serializacao():
    e = novo("REF_CAMPO_INEXISTENTE", "/regras/0/campo", "mensagem", valor="x")
    assert e.severidade == "erro" and e.camada == "semantica"
    assert e.como_dict() == {"codigo": "REF_CAMPO_INEXISTENTE", "caminho": "/regras/0/campo", "mensagem": "mensagem",
                             "severidade": "erro", "camada": "semantica", "detalhes": {"valor": "x"}}
    json.dumps(e.como_dict())


def test_ponteiro_escapa_caracteres_especiais():
    assert ponteiro() == ""
    assert ponteiro("regras", 3, "a/b", "c~d") == "/regras/3/a~1b/c~0d"


def test_ordenacao_numerica_dos_indices():
    erros = [ErroValidacao("B", "/regras/10", "m", "erro", "semantica"),
             ErroValidacao("A", "/regras/2", "m", "erro", "semantica"),
             ErroValidacao("A", "/entidades/0", "m", "erro", "semantica"),
             ErroValidacao("A", "/regras/2", "a", "erro", "semantica")]
    assert [(e.caminho, e.codigo, e.mensagem) for e in ordenar(erros)] == [
        ("/entidades/0", "A", "m"), ("/regras/2", "A", "a"), ("/regras/2", "A", "m"), ("/regras/10", "B", "m")]


def test_validar_arquivo_igual_a_validar(padaria):
    assert validar_arquivo(EXEMPLO_PADARIA) == validar(padaria) == []


# ---- camada estrutural

def test_versao_antiga_tem_codigo_proprio(padaria):
    padaria["versao_mapa"] = "0.1"
    erros = validar_e_conferir(padaria)
    assert [(e.codigo, e.caminho, e.camada) for e in erros] == [("VERSAO_NAO_SUPORTADA", "/versao_mapa", "estrutural")]
    assert "migração" in erros[0].mensagem


def test_erro_estrutural_impede_a_camada_semantica(padaria):
    padaria["tema"]["cor_primaria"] = "laranja"                                    # erro de forma
    padaria["regras"][0]["entidade"] = "inexistente"                               # erro de sentido
    erros = validar_e_conferir(padaria)
    assert erros and all(e.camada == "estrutural" for e in erros)
    assert ("ESQUEMA_PATTERN", "/tema/cor_primaria") in [(e.codigo, e.caminho) for e in erros]


def test_propriedade_obrigatoria_ausente(padaria):
    del padaria["tema"]
    erros = validar_e_conferir(padaria)
    assert [(e.codigo, e.caminho) for e in erros] == [("ESQUEMA_REQUIRED", "")]


# ---- linha de comando

def _cli(*args, cwd=RAIZ):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONPATH=str(RAIZ / "src"))
    return subprocess.run([sys.executable, "-m", "forja", *args], cwd=cwd, env=env,
                          capture_output=True, text=True, encoding="utf-8")


def test_cli_mapa_valido_sai_com_zero():
    r = _cli("validar", str(EXEMPLO_PADARIA))
    assert r.returncode == 0, r.stderr
    assert "VÁLIDO: 0 erro(s), 0 aviso(s)." in r.stdout


def test_cli_mapa_com_erro_sai_com_um_e_json_legivel(tmp_path, padaria):
    padaria["regras"][0]["entidade"] = "inexistente"
    arquivo = tmp_path / "mapa.json"
    arquivo.write_text(json.dumps(padaria), encoding="utf-8")
    r = _cli("validar", str(arquivo), "--json")
    assert r.returncode == 1, r.stderr
    saida = json.loads(r.stdout)
    assert {"codigo": "REF_ENTIDADE_INEXISTENTE", "caminho": "/regras/0/entidade"}.items() <= saida[0].items()


def test_cli_json_quebrado_ou_arquivo_ausente_sai_com_dois(tmp_path):
    quebrado = tmp_path / "quebrado.json"
    quebrado.write_text("{ isto não é json", encoding="utf-8")
    assert _cli("validar", str(quebrado)).returncode == 2
    assert _cli("validar", str(tmp_path / "nao_existe.json")).returncode == 2


# ---- garantia de implementação

def test_nenhum_eval_exec_ou_compile_no_pacote():
    proibidas = {"eval", "exec", "compile", "__import__"}
    encontradas = []
    for arquivo in sorted(SRC_FORJA.rglob("*.py")):
        for no in ast.walk(ast.parse(arquivo.read_text(encoding="utf-8"))):
            if isinstance(no, ast.Call) and isinstance(no.func, ast.Name) and no.func.id in proibidas:
                encontradas.append(f"{arquivo.name}:{no.lineno} {no.func.id}")
    assert encontradas == []
