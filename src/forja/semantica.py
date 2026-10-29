"""Camada 2: validação SEMÂNTICA (coerência) de um mapa já estruturalmente válido.

Verifica referências, caminhos, tipos, cálculos e seus ciclos, ações, ciclo de vida,
telas, perfis e testes de aceitação. As expressões são percorridas como árvore de
dados; nada é executado (sem eval/exec).
"""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime

from .caminhos import FAMILIA_DO_TIPO, FalhaCaminho, Modelo, Resolucao, origem_do_campo
from .erros import ErroValidacao, novo, ordenar, ponteiro

_CAMPOS_TEXTUAIS_DA_REGRA = {"id", "nome", "frase_original", "exemplos"}


@dataclass(frozen=True)
class TipoExpr:
    familia: str                       # numero | texto | data | booleano | nulo
    opcoes: tuple[str, ...] | None = None
    literal_data: bool = False         # literal de texto que é uma data ISO válida


def _data_valida(texto, com_hora: bool) -> bool:
    if not isinstance(texto, str):
        return False
    try:
        if com_hora:
            if "T" not in texto:
                return False
            datetime.fromisoformat(texto)
        else:
            date.fromisoformat(texto)
    except ValueError:
        return False
    return True


def validar_semantica(mapa: dict) -> list[ErroValidacao]:
    """Pressupõe um mapa estruturalmente válido (ver forja.validacao.validar)."""
    v = _Validador(mapa)
    v.executar()
    return ordenar(v.erros)


class _Validador:
    def __init__(self, mapa: dict):
        self.mapa = mapa
        self.erros: list[ErroValidacao] = []
        self.m = Modelo.do_mapa(mapa)
        # ciclo de vida por entidade: {"estados": {id: (i, obj)}, "transicoes": {id: (i, obj)}}
        self.ciclos: dict[str, dict] = {}
        self.calculos: dict[tuple[str, str], list[int]] = defaultdict(list)
        self.dependencias: dict[tuple[str, str], set[tuple[str, str]]] = {}
        self.alvos_de_acao: set[tuple[str, str]] = set()
        self.transicoes_com_efeito: dict[tuple[str, str], list[int]] = defaultdict(list)

    # ------------------------------------------------------------------ utilidades
    def err(self, codigo: str, partes: tuple, mensagem: str, **detalhes) -> None:
        self.erros.append(novo(codigo, ponteiro(*partes), mensagem, **detalhes))

    def _duplicados(self, itens: list, base: tuple, rotulo: str, codigo: str = "ID_DUPLICADO", chave: str = "id") -> None:
        vistos: dict[str, int] = {}
        for i, item in enumerate(itens):
            valor = item[chave]
            if valor in vistos:
                self.err(codigo, base + (i, chave), f"{rotulo} '{valor}' repetido (primeira ocorrência no índice {vistos[valor]}).",
                         valor=valor, primeira=vistos[valor])
            else:
                vistos[valor] = i

    def _caminho_erro(self, falha: FalhaCaminho, partes: tuple) -> None:
        self.err(falha.codigo, partes, falha.mensagem, **falha.detalhes)

    def _resolver_valor(self, entidade: str, caminho: str, partes: tuple) -> Resolucao | None:
        """Resolve um caminho que precisa terminar num campo (valor)."""
        r = self.m.resolver(entidade, caminho)
        if isinstance(r, FalhaCaminho):
            self._caminho_erro(r, partes)
            return None
        if r.tipo == "colecao":
            self.err("COLECAO_ONDE_SE_ESPERA_VALOR", partes,
                     f"'{caminho}' é uma coleção de '{r.entidade}'; aqui é preciso um valor (use uma agregação).", valor=caminho)
            return None
        if r.tipo == "registro":
            self.err("CAMINHO_INVALIDO", partes,
                     f"'{caminho}' aponta para um registro de '{r.entidade}', não para um campo.", valor=caminho)
            return None
        return r

    # ------------------------------------------------------------------ execução
    def executar(self) -> None:
        self._metadados()
        self._entidades()
        self._relacionamentos()
        self._ciclos_de_vida()
        self._regras()
        self._pos_regras()
        self._telas()
        self._perfis()
        self._testes()

    # ------------------------------------------------------------------ metadados
    def _metadados(self) -> None:
        valor = self.mapa["metadados"]["criado_em"]
        if not _data_valida(valor, com_hora=True):
            self.err("DATA_INVALIDA", ("metadados", "criado_em"), f"'{valor}' não é uma data-hora ISO 8601 válida.", valor=valor)

    # ------------------------------------------------------------------ entidades
    def _entidades(self) -> None:
        entidades = self.mapa["entidades"]
        self._duplicados(entidades, ("entidades",), "Entidade")
        for ei, ent in enumerate(entidades):
            base = ("entidades", ei)
            self._duplicados(ent["campos"], base + ("campos",), f"Campo de '{ent['id']}'")
            if ent["rotulo"] not in {c["id"] for c in ent["campos"]}:
                self.err("REF_CAMPO_INEXISTENTE", base + ("rotulo",),
                         f"O rótulo '{ent['rotulo']}' não é campo de '{ent['id']}'.", valor=ent["rotulo"])
            for ci, campo in enumerate(ent["campos"]):
                pc = base + ("campos", ci)
                if "calculado" in campo:
                    self.err("CAMPO_CALCULADO_OBSOLETO", pc + ("calculado",),
                             f"'calculado' em '{ent['id']}.{campo['id']}' é obsoleto; use \"origem\": \"calculo\".")
                padrao = campo.get("padrao")
                if padrao is None:
                    continue
                if campo["tipo"] == "opcoes" and padrao not in campo["opcoes"]:
                    self.err("VALOR_FORA_DAS_OPCOES", pc + ("padrao",),
                             f"Padrão '{padrao}' não está nas opções de '{ent['id']}.{campo['id']}'.",
                             valor=padrao, opcoes=campo["opcoes"])
                elif campo["tipo"] in ("data", "data_hora") and not _data_valida(padrao, campo["tipo"] == "data_hora"):
                    self.err("DATA_INVALIDA", pc + ("padrao",), f"Padrão '{padrao}' não é uma data válida.", valor=padrao)

    # ------------------------------------------------------------------ relacionamentos
    def _relacionamentos(self) -> None:
        rels = self.mapa["relacionamentos"]
        self._duplicados(rels, ("relacionamentos",), "Relacionamento")
        for ri, rel in enumerate(rels):
            for chave in ("origem", "destino"):
                if rel[chave] not in self.m.entidades:
                    self.err("REF_ENTIDADE_INEXISTENTE", ("relacionamentos", ri, chave),
                             f"A entidade '{rel[chave]}' do relacionamento '{rel['id']}' não existe.", valor=rel[chave])
        for ri, chave, entidade, nome in self.m.conflitos:
            self.err("NOME_CONFLITANTE", ("relacionamentos", ri, chave),
                     f"O nome '{nome}' já é usado em '{entidade}' (campo ou outro relacionamento).", valor=nome, entidade=entidade)

    # ------------------------------------------------------------------ ciclo de vida
    def _ciclos_de_vida(self) -> None:
        campos_de_estado = set()
        for ei, ent in enumerate(self.mapa["entidades"]):
            ciclo = ent.get("ciclo_de_vida")
            if ciclo is None or self.m.indice_entidade.get(ent["id"]) != ei:
                continue
            base = ("entidades", ei, "ciclo_de_vida")
            eid = ent["id"]
            estados = {}
            for si, est in enumerate(ciclo["estados"]):
                estados.setdefault(est["id"], (si, est))
            transicoes = {}
            for ti, tr in enumerate(ciclo["transicoes"]):
                transicoes.setdefault(tr["id"], (ti, tr))
            self.ciclos[eid] = {"estados": estados, "transicoes": transicoes, "base": base}
            self._duplicados(ciclo["estados"], base + ("estados",), f"Estado de '{eid}'")
            self._duplicados(ciclo["transicoes"], base + ("transicoes",), f"Transição de '{eid}'")

            # campo de estado
            campo = self.m.campos[eid].get(ciclo["campo"])
            campos_de_estado.add((eid, ciclo["campo"]))
            if campo is None:
                self.err("REF_CAMPO_INEXISTENTE", base + ("campo",),
                         f"O campo de estado '{ciclo['campo']}' não existe em '{eid}'.", valor=ciclo["campo"])
            else:
                problemas = []
                if campo["tipo"] != "opcoes":
                    problemas.append("precisa ser do tipo 'opcoes'")
                elif set(campo["opcoes"]) != set(estados):
                    problemas.append(f"as opções {sorted(campo['opcoes'])} precisam ser exatamente os estados {sorted(estados)}")
                if origem_do_campo(campo) != "estado":
                    problemas.append("precisa ter origem 'estado'")
                if campo.get("padrao") is not None and campo["padrao"] != ciclo["inicial"]:
                    problemas.append(f"o padrão '{campo['padrao']}' precisa ser o estado inicial '{ciclo['inicial']}'")
                if problemas:
                    self.err("CAMPO_ESTADO_INVALIDO", base + ("campo",),
                             f"Campo de estado '{eid}.{ciclo['campo']}': " + "; ".join(problemas) + ".")

            if ciclo["inicial"] not in estados:
                self.err("ESTADO_INICIAL_INEXISTENTE", base + ("inicial",),
                         f"O estado inicial '{ciclo['inicial']}' não está entre os estados de '{eid}'.", valor=ciclo["inicial"])

            finais = {e for e, (_, obj) in estados.items() if obj.get("final")}
            for ti, tr in enumerate(ciclo["transicoes"]):
                pt = base + ("transicoes", ti)
                for j, de in enumerate(tr["de"]):
                    if de not in estados:
                        self.err("REF_ESTADO_INEXISTENTE", pt + ("de", j), f"O estado '{de}' não existe em '{eid}'.", valor=de)
                    elif de in finais:
                        self.err("TRANSICAO_DE_ESTADO_FINAL", pt + ("de", j),
                                 f"A transição '{tr['id']}' sai do estado final '{de}'.", valor=de)
                if tr["para"] not in estados:
                    self.err("REF_ESTADO_INEXISTENTE", pt + ("para",), f"O estado '{tr['para']}' não existe em '{eid}'.", valor=tr["para"])
                if "estorna" in tr:
                    alvo = transicoes.get(tr["estorna"])
                    if alvo is None:
                        self.err("REF_TRANSICAO_INEXISTENTE", pt + ("estorna",),
                                 f"A transição estornada '{tr['estorna']}' não existe em '{eid}'.", valor=tr["estorna"])
                    elif tr["estorna"] == tr["id"]:
                        self.err("ESTORNO_INVALIDO", pt + ("estorna",), f"A transição '{tr['id']}' não pode estornar a si mesma.")
                    else:
                        para_estornada = alvo[1]["para"]
                        invalidos = [d for d in tr["de"] if d != para_estornada]
                        if invalidos:
                            self.err("ESTORNO_INVALIDO", pt + ("de",),
                                     f"'{tr['id']}' estorna '{tr['estorna']}', então só pode partir de '{para_estornada}' "
                                     f"(o estado que '{tr['estorna']}' produz); parte também de {invalidos}.",
                                     invalidos=invalidos, esperado=para_estornada)

            for j, rid in enumerate(ciclo.get("detalhes", [])):
                rel = self.m.relacionamentos.get(rid)
                if rel is None:
                    self.err("REF_RELACIONAMENTO_INEXISTENTE", base + ("detalhes", j),
                             f"O relacionamento '{rid}' não existe.", valor=rid)
                elif rel["origem"] != eid:
                    self.err("DETALHE_INVALIDO", base + ("detalhes", j),
                             f"O detalhe '{rid}' precisa partir de '{eid}' (parte de '{rel['origem']}').", valor=rid)

            if ciclo["inicial"] in estados:
                alcancados = {ciclo["inicial"]}
                pendentes = [ciclo["inicial"]]
                while pendentes:
                    atual = pendentes.pop()
                    for _, tr in transicoes.values():
                        if atual in tr["de"] and tr["para"] not in alcancados:
                            alcancados.add(tr["para"])
                            pendentes.append(tr["para"])
                for est_id, (si, _) in estados.items():
                    if est_id not in alcancados:
                        self.err("ESTADO_INALCANCAVEL", base + ("estados", si, "id"),
                                 f"O estado '{est_id}' de '{eid}' não é alcançado a partir de '{ciclo['inicial']}'.", valor=est_id)

        # campos com origem 'estado' que não são campo de nenhum ciclo de vida
        for eid, campos in self.m.campos.items():
            for cid, campo in campos.items():
                if origem_do_campo(campo) == "estado" and (eid, cid) not in campos_de_estado:
                    ei, ci = self.m.indice_entidade[eid], self.m.indice_campo[(eid, cid)]
                    self.err("CAMPO_ESTADO_INVALIDO", ("entidades", ei, "campos", ci, "origem"),
                             f"'{eid}.{cid}' tem origem 'estado', mas não é o campo de um ciclo de vida.")

    # ------------------------------------------------------------------ expressões
    def _tipo(self, expr: dict, entidade: str, partes: tuple, deps: set | None) -> TipoExpr | None:
        """Tipo de uma expressão; reporta erros e devolve None quando não dá para tipar."""
        if "valor" in expr:
            v = expr["valor"]
            if isinstance(v, bool):
                return TipoExpr("booleano")
            if isinstance(v, (int, float)):
                return TipoExpr("numero")
            if v is None:
                return TipoExpr("nulo")
            return TipoExpr("texto", literal_data=_data_valida(v, False) or _data_valida(v, True))
        if "campo" in expr:
            r = self._resolver_valor(entidade, expr["campo"], partes + ("campo",))
            if r is None:
                return None
            if deps is not None:
                deps.add((r.entidade, r.campo["id"]))
            opcoes = tuple(r.campo["opcoes"]) if r.campo["tipo"] == "opcoes" else None
            return TipoExpr(r.familia, opcoes)
        if "funcao" in expr:
            return TipoExpr("data")
        if "op" in expr:
            ok = True
            for i, arg in enumerate(expr["args"]):
                t = self._tipo(arg, entidade, partes + ("args", i), deps)
                if t is None:
                    ok = False
                elif t.familia != "numero":
                    self.err("TIPO_INCOMPATIVEL", partes + ("args", i),
                             f"A operação '{expr['op']}' só aceita números; o argumento {i} é '{t.familia}'.", familia=t.familia)
                    ok = False
            return TipoExpr("numero") if ok else None
        if "comparar" in expr:
            te = self._tipo(expr["esq"], entidade, partes + ("esq",), deps)
            td = self._tipo(expr["dir"], entidade, partes + ("dir",), deps)
            if te is not None and td is not None:
                self._comparacao(expr, te, td, partes)
            return TipoExpr("booleano")
        for chave in ("e", "ou"):
            if chave in expr:
                for i, arg in enumerate(expr[chave]):
                    self._exigir_booleano(arg, entidade, partes + (chave, i), deps)
                return TipoExpr("booleano")
        if "nao" in expr:
            self._exigir_booleano(expr["nao"], entidade, partes + ("nao",), deps)
            return TipoExpr("booleano")
        if "agregar" in expr:
            return self._agregacao(expr, entidade, partes, deps)
        return None  # inalcançável num mapa estruturalmente válido

    def _comparacao(self, expr: dict, te: TipoExpr, td: TipoExpr, partes: tuple) -> None:
        op = expr["comparar"]

        def compativeis(a: TipoExpr, b: TipoExpr) -> bool:
            if a.familia == b.familia:
                return True
            datas = {a.familia, b.familia} == {"data", "texto"} and (a.literal_data or b.literal_data)
            return datas

        if op in ("=", "!="):
            ok = "nulo" in (te.familia, td.familia) or compativeis(te, td)
        else:
            ok = compativeis(te, td) and {te.familia, td.familia} <= {"numero", "data", "texto"} and \
                (te.familia in ("numero", "data") or td.familia in ("numero", "data"))
        if not ok:
            self.err("TIPO_INCOMPATIVEL", partes,
                     f"Comparação '{op}' entre '{te.familia}' e '{td.familia}' não é permitida.",
                     esquerda=te.familia, direita=td.familia)
            return
        for lado_campo, lado_valor, t in (("esq", "dir", te), ("dir", "esq", td)):
            literal = expr[lado_valor]
            if t.opcoes and "valor" in literal and isinstance(literal["valor"], str) and literal["valor"] not in t.opcoes:
                self.err("VALOR_FORA_DAS_OPCOES", partes + (lado_valor, "valor"),
                         f"'{literal['valor']}' não está nas opções {list(t.opcoes)}.", valor=literal["valor"], opcoes=list(t.opcoes))

    def _exigir_booleano(self, expr: dict, entidade: str, partes: tuple, deps: set | None) -> None:
        t = self._tipo(expr, entidade, partes, deps)
        if t is not None and t.familia != "booleano":
            self.err("CONDICAO_NAO_BOOLEANA", partes, f"Era esperada uma condição (verdadeiro/falso); a expressão é '{t.familia}'.",
                     familia=t.familia)

    def _agregacao(self, expr: dict, entidade: str, partes: tuple, deps: set | None) -> TipoExpr | None:
        r = self.m.resolver(entidade, expr["colecao"])
        if isinstance(r, FalhaCaminho):
            self._caminho_erro(r, partes + ("colecao",))
            return None
        if r.tipo != "colecao":
            self.err("AGREGACAO_SEM_COLECAO", partes + ("colecao",),
                     f"'{expr['colecao']}' não é uma coleção; agregações precisam de uma coleção.", valor=expr["colecao"])
            return None
        filho = r.entidade
        if "filtro" in expr:
            self._exigir_booleano(expr["filtro"], filho, partes + ("filtro",), deps)
        tipo = expr["agregar"]
        if tipo == "contagem":
            if "expr" in expr:
                self._tipo(expr["expr"], filho, partes + ("expr",), deps)
            return TipoExpr("numero")
        if "expr" not in expr:
            self.err("AGREGACAO_SEM_EXPRESSAO", partes, f"'{tipo}' precisa de 'expr' com o valor a agregar.")
            return None
        t = self._tipo(expr["expr"], filho, partes + ("expr",), deps)
        if t is None:
            return None
        permitidas = ("numero",) if tipo == "soma" else ("numero", "data")
        if t.familia not in permitidas:
            self.err("TIPO_INCOMPATIVEL", partes + ("expr",), f"'{tipo}' não se aplica a '{t.familia}'.", familia=t.familia)
            return None
        return TipoExpr(t.familia)

    # ------------------------------------------------------------------ regras
    def _regras(self) -> None:
        regras = self.mapa["regras"]
        self._duplicados(regras, ("regras",), "Regra", codigo="REGRA_DUPLICADA")
        assinaturas: dict[str, int] = {}
        for i, r in enumerate(regras):
            base = ("regras", i)
            assinatura = json.dumps({k: v for k, v in r.items() if k not in _CAMPOS_TEXTUAIS_DA_REGRA}, sort_keys=True)
            if assinatura in assinaturas:
                self.err("REGRA_EQUIVALENTE", base, f"A regra '{r['id']}' é idêntica à regra '{regras[assinaturas[assinatura]]['id']}'.",
                         igual_a=regras[assinaturas[assinatura]]["id"])
            else:
                assinaturas[assinatura] = i

            ent = r["entidade"]
            if ent not in self.m.entidades:
                self.err("REF_ENTIDADE_INEXISTENTE", base + ("entidade",), f"A entidade '{ent}' da regra '{r['id']}' não existe.", valor=ent)
                continue

            if "transicoes" in r:
                ciclo = self.ciclos.get(ent)
                if ciclo is None:
                    self.err("GATILHO_SEM_CICLO", base + ("transicoes",),
                             f"A regra '{r['id']}' é disparada por transição, mas '{ent}' não tem ciclo de vida.")
                else:
                    for j, t in enumerate(r["transicoes"]):
                        if t not in ciclo["transicoes"]:
                            self.err("REF_TRANSICAO_INEXISTENTE", base + ("transicoes", j),
                                     f"A transição '{t}' não existe em '{ent}'.", valor=t)

            contexto = ent
            if "para_cada" in r:
                rp = self.m.resolver(ent, r["para_cada"])
                if isinstance(rp, FalhaCaminho) or rp.tipo != "colecao":
                    self.err("PARA_CADA_INVALIDO", base + ("para_cada",),
                             f"'{r['para_cada']}' não é uma coleção de '{ent}'.", valor=r["para_cada"])
                    continue
                contexto = rp.entidade

            if r["tipo"] == "restricao":
                self._exigir_booleano(r["condicao"], contexto, base + ("condicao",), None)
            elif r["tipo"] == "calculo":
                self._regra_calculo(r, i, base)
            else:
                self._regra_acao(r, i, base, ent, contexto)

    def _regra_calculo(self, r: dict, i: int, base: tuple) -> None:
        ent = r["entidade"]
        campo = self.m.campos[ent].get(r["campo"])
        if campo is None:
            self.err("REF_CAMPO_INEXISTENTE", base + ("campo",), f"O campo '{r['campo']}' não existe em '{ent}'.", valor=r["campo"])
            return
        if origem_do_campo(campo) != "calculo":
            self.err("CALCULO_EM_CAMPO_NAO_CALCULADO", base + ("campo",),
                     f"'{ent}.{r['campo']}' tem origem '{origem_do_campo(campo)}'; só campos de origem 'calculo' recebem regra de cálculo.")
            return
        chave = (ent, r["campo"])
        self.calculos[chave].append(i)
        deps: set = set()
        t = self._tipo(r["expressao"], ent, base + ("expressao",), deps)
        if len(self.calculos[chave]) == 1:
            self.dependencias[chave] = deps
        if t is not None and t.familia != FAMILIA_DO_TIPO[campo["tipo"]]:
            self.err("CALCULO_TIPO_INCOMPATIVEL", base + ("expressao",),
                     f"O cálculo resulta em '{t.familia}', mas '{ent}.{r['campo']}' é '{campo['tipo']}'.",
                     familia=t.familia, tipo_campo=campo["tipo"])

    def _regra_acao(self, r: dict, i: int, base: tuple, ent: str, contexto: str) -> None:
        for j, ev in enumerate(r.get("eventos", [])):
            if ev == "editar":
                self.err("ACAO_EM_EDICAO_NAO_SUPORTADA", base + ("eventos", j),
                         f"A ação '{r['id']}' dispara na edição, o que não é suportado no MVP (decisão P3).")
        if r.get("reverter_ao_excluir") is True and "transicoes" in r:
            self.err("REVERTER_EM_TRANSICAO", base + ("reverter_ao_excluir",),
                     f"A ação '{r['id']}' é disparada por transição; o estorno é feito pela transição com 'estorna'.")
        for t in r.get("transicoes", []):
            self.transicoes_com_efeito[(ent, t)].append(i)
        if "condicao" in r:
            self._exigir_booleano(r["condicao"], contexto, base + ("condicao",), None)
        alvo = self._resolver_valor(contexto, r["alvo"], base + ("alvo",))
        tv = self._tipo(r["valor"], contexto, base + ("valor",), None)
        if alvo is None:
            return
        origem = origem_do_campo(alvo.campo)
        nome = f"{alvo.entidade}.{alvo.campo['id']}"
        if origem == "calculo":
            self.err("ACAO_ALTERA_CALCULADO", base + ("alvo",), f"A ação '{r['id']}' altera '{nome}', que é calculado.", alvo=nome)
            return
        if origem == "estado":
            self.err("ACAO_ALTERA_ESTADO", base + ("alvo",),
                     f"A ação '{r['id']}' altera '{nome}', que é campo de estado (só transições o alteram).", alvo=nome)
            return
        self.alvos_de_acao.add((alvo.entidade, alvo.campo["id"]))
        if r["operacao"] in ("somar", "subtrair"):
            if alvo.familia != "numero":
                self.err("ACAO_TIPO_INCOMPATIVEL", base + ("alvo",), f"'{r['operacao']}' exige alvo numérico; '{nome}' é '{alvo.campo['tipo']}'.")
            elif tv is not None and tv.familia != "numero":
                self.err("ACAO_TIPO_INCOMPATIVEL", base + ("valor",), f"'{r['operacao']}' exige valor numérico; o valor é '{tv.familia}'.")
        elif tv is not None and tv.familia not in (alvo.familia, "nulo"):
            self.err("ACAO_TIPO_INCOMPATIVEL", base + ("valor",), f"'definir' com valor '{tv.familia}' em '{nome}' ('{alvo.campo['tipo']}').")

    # ------------------------------------------------------------------ após as regras
    def _pos_regras(self) -> None:
        regras = self.mapa["regras"]
        for (ent, cid), indices in self.calculos.items():
            for k in indices[1:]:
                self.err("CALCULO_DUPLICADO", ("regras", k, "campo"),
                         f"'{ent}.{cid}' já é calculado pela regra '{regras[indices[0]]['id']}'.", primeira=regras[indices[0]]["id"])

        for eid, campos in self.m.campos.items():
            for cid, campo in campos.items():
                origem = origem_do_campo(campo)
                chave_origem = "origem" if "origem" in campo else "calculado"
                partes = ("entidades", self.m.indice_entidade[eid], "campos", self.m.indice_campo[(eid, cid)], chave_origem)
                if origem == "calculo" and (eid, cid) not in self.calculos:
                    self.err("CALCULADO_SEM_REGRA", partes, f"'{eid}.{cid}' é calculado, mas nenhuma regra de cálculo o define.")
                if origem == "acao" and (eid, cid) not in self.alvos_de_acao:
                    self.err("CAMPO_ACAO_SEM_ACAO", partes, f"'{eid}.{cid}' tem origem 'acao', mas nenhuma ação o altera.")

        self._ciclos_de_calculo()

        for (ent, t), _ in sorted(self.transicoes_com_efeito.items()):
            ciclo = self.ciclos.get(ent)
            if not ciclo or t not in ciclo["transicoes"]:
                continue
            para = ciclo["transicoes"][t][1]["para"]
            if para in ciclo["estados"]:
                si, estado = ciclo["estados"][para]
                if estado["excluivel"]:
                    self.err("EXCLUSAO_COM_EFEITOS", ciclo["base"] + ("estados", si, "excluivel"),
                             f"'{para}' é alcançado por '{t}', que tem efeitos; registros nesse estado não podem ser excluídos "
                             "(devem ser estornados por uma transição).", transicao=t)

    def _ciclos_de_calculo(self) -> None:
        grafo = {no: sorted(d for d in deps if d in self.dependencias) for no, deps in self.dependencias.items()}
        ciclos: set[tuple] = set()
        cor: dict = {}
        pilha: list = []

        def visitar(no) -> None:
            cor[no] = 1
            pilha.append(no)
            for vizinho in grafo.get(no, []):
                if cor.get(vizinho) == 1:
                    ciclo = pilha[pilha.index(vizinho):]
                    k = ciclo.index(min(ciclo))
                    ciclos.add(tuple(ciclo[k:] + ciclo[:k]))
                elif cor.get(vizinho) is None:
                    visitar(vizinho)
            pilha.pop()
            cor[no] = 2

        for no in sorted(grafo):
            if cor.get(no) is None:
                visitar(no)
        for ciclo in sorted(ciclos):
            nomes = [f"{e}.{c}" for e, c in ciclo] + [f"{ciclo[0][0]}.{ciclo[0][1]}"]
            indice = self.calculos[ciclo[0]][0]
            self.err("CICLO_DE_CALCULO", ("regras", indice, "expressao"),
                     "Cálculos em círculo: " + " → ".join(nomes) + ".", ciclo=nomes)

    # ------------------------------------------------------------------ telas
    def _telas(self) -> None:
        telas = self.mapa["telas"]
        itens = telas["itens"]
        self._duplicados(itens, ("telas", "itens"), "Tela")
        ids = {t["id"] for t in itens}
        vistos = set()
        for k, tid in enumerate(telas["menu"]):
            if tid not in ids:
                self.err("REF_TELA_INEXISTENTE", ("telas", "menu", k), f"A tela '{tid}' do menu não existe.", valor=tid)
            elif tid in vistos:
                self.err("ID_DUPLICADO", ("telas", "menu", k), f"A tela '{tid}' aparece mais de uma vez no menu.", valor=tid)
            vistos.add(tid)

        for ti, tela in enumerate(itens):
            base = ("telas", "itens", ti)
            for ii, ind in enumerate(tela.get("indicadores", [])):
                self._indicador(ind, base + ("indicadores", ii))
            if "indicadores" in tela:
                self._duplicados(tela["indicadores"], base + ("indicadores",), "Indicador")
            if "entidade" not in tela:
                continue
            ent = tela["entidade"]
            if ent not in self.m.entidades:
                self.err("REF_ENTIDADE_INEXISTENTE", base + ("entidade",), f"A entidade '{ent}' da tela '{tela['id']}' não existe.", valor=ent)
                continue
            for chave in ("campos", "filtros"):
                for k, cam in enumerate(tela.get(chave, [])):
                    self._resolver_valor(ent, cam, base + (chave, k))
            if "agrupar_por" in tela:
                self._resolver_valor(ent, tela["agrupar_por"], base + ("agrupar_por",))
            if "detalhe" in tela:
                rel = self.m.relacionamentos.get(tela["detalhe"])
                if rel is None:
                    self.err("REF_RELACIONAMENTO_INEXISTENTE", base + ("detalhe",), f"O relacionamento '{tela['detalhe']}' não existe.",
                             valor=tela["detalhe"])
                elif rel["origem"] != ent:
                    self.err("DETALHE_INVALIDO", base + ("detalhe",),
                             f"O detalhe '{tela['detalhe']}' precisa partir de '{ent}' (parte de '{rel['origem']}').", valor=tela["detalhe"])
            for chave, familia, descricao in (("campo_periodo", "data", "uma data"), ("totalizar", "numero", "um número")):
                if chave in tela:
                    campo = self.m.campos[ent].get(tela[chave])
                    if campo is None:
                        self.err("REF_CAMPO_INEXISTENTE", base + (chave,), f"O campo '{tela[chave]}' não existe em '{ent}'.", valor=tela[chave])
                    elif FAMILIA_DO_TIPO[campo["tipo"]] != familia:
                        self.err("TIPO_INCOMPATIVEL", base + (chave,), f"'{chave}' precisa ser {descricao}; '{ent}.{tela[chave]}' é '{campo['tipo']}'.")
            if "filtro" in tela:
                self._exigir_booleano(tela["filtro"], ent, base + ("filtro",), None)

    def _indicador(self, ind: dict, base: tuple) -> None:
        ent = ind["entidade"]
        if ent not in self.m.entidades:
            self.err("REF_ENTIDADE_INEXISTENTE", base + ("entidade",), f"A entidade '{ent}' do indicador '{ind['id']}' não existe.", valor=ent)
            return
        if "campo" in ind:
            campo = self.m.campos[ent].get(ind["campo"])
            if campo is None:
                self.err("REF_CAMPO_INEXISTENTE", base + ("campo",), f"O campo '{ind['campo']}' não existe em '{ent}'.", valor=ind["campo"])
            elif ind["agregar"] == "soma" and FAMILIA_DO_TIPO[campo["tipo"]] != "numero":
                self.err("TIPO_INCOMPATIVEL", base + ("campo",), f"'soma' exige campo numérico; '{ent}.{ind['campo']}' é '{campo['tipo']}'.")
        elif ind["agregar"] == "soma":
            self.err("AGREGACAO_SEM_EXPRESSAO", base, f"O indicador '{ind['id']}' soma, mas não diz qual campo.")
        if "filtro" in ind:
            self._exigir_booleano(ind["filtro"], ent, base + ("filtro",), None)

    # ------------------------------------------------------------------ perfis
    def _perfis(self) -> None:
        perfis = self.mapa["perfis"]
        self._duplicados(perfis, ("perfis",), "Perfil")
        citadas = set()
        for pi, perfil in enumerate(perfis):
            base = ("perfis", pi)
            for ent in perfil["permissoes"]:
                citadas.add(ent)
                if ent not in self.m.entidades:
                    self.err("PERFIL_ENTIDADE_INEXISTENTE", base + ("permissoes", ent),
                             f"O perfil '{perfil['id']}' cita a entidade inexistente '{ent}'.", valor=ent)
            for ent, transicoes in perfil.get("permissoes_transicoes", {}).items():
                if ent not in self.m.entidades:
                    self.err("PERFIL_ENTIDADE_INEXISTENTE", base + ("permissoes_transicoes", ent),
                             f"O perfil '{perfil['id']}' cita a entidade inexistente '{ent}'.", valor=ent)
                    continue
                ciclo = self.ciclos.get(ent)
                for j, t in enumerate(transicoes):
                    if ciclo is None or t not in ciclo["transicoes"]:
                        self.err("REF_TRANSICAO_INEXISTENTE", base + ("permissoes_transicoes", ent, j),
                                 f"A transição '{t}' não existe em '{ent}'.", valor=t)
        for eid, ei in self.m.indice_entidade.items():
            if eid not in citadas:
                self.err("PERFIL_SEM_ENTIDADE", ("entidades", ei, "id"), f"Nenhum perfil tem permissões sobre '{eid}'.", valor=eid)

    # ------------------------------------------------------------------ testes de aceitação
    def _testes(self) -> None:
        testes = self.mapa["testes_aceitacao"]
        self._duplicados(testes, ("testes_aceitacao",), "Teste")
        ids_regras = {r["id"] for r in self.mapa["regras"]}
        for ti, teste in enumerate(testes):
            base = ("testes_aceitacao", ti)
            if "regra" in teste and teste["regra"] not in ids_regras:
                self.err("REF_REGRA_INEXISTENTE", base + ("regra",), f"A regra '{teste['regra']}' não existe.", valor=teste["regra"])
            refs: dict[str, str] = {}

            def registrar(ref: str, ent: str, partes: tuple) -> None:
                if ref in refs:
                    self.err("ID_DUPLICADO", partes, f"A referência '@{ref}' já foi criada neste teste.", valor=ref)
                else:
                    refs[ref] = ent

            for pi, prep in enumerate(teste.get("preparacao", [])):
                pp = base + ("preparacao", pi)
                ent = prep["entidade"]
                if ent not in self.m.entidades:
                    self.err("REF_ENTIDADE_INEXISTENTE", pp + ("entidade",), f"A entidade '{ent}' não existe.", valor=ent)
                    continue
                self._dados(ent, prep.get("dados", {}), pp + ("dados",), refs)
                for chave, valor in prep.get("forcar", {}).items():
                    campo = self.m.campos[ent].get(chave)
                    if campo is None:
                        self.err("REF_CAMPO_INEXISTENTE", pp + ("forcar", chave), f"O campo '{chave}' não existe em '{ent}'.", valor=chave)
                    elif origem_do_campo(campo) == "usuario":
                        self.err("FORCAR_CAMPO_DE_USUARIO", pp + ("forcar", chave),
                                 f"'{ent}.{chave}' é um campo comum (origem 'usuario'); informe-o em 'dados', não em 'forcar'.")
                    else:
                        self._valor_de_campo(campo, valor, pp + ("forcar", chave))
                registrar(prep["ref"], ent, pp + ("ref",))

            for si, passo in enumerate(teste["passos"]):
                ps = base + ("passos", si)
                ent = passo["entidade"]
                if ent not in self.m.entidades:
                    self.err("REF_ENTIDADE_INEXISTENTE", ps + ("entidade",), f"A entidade '{ent}' não existe.", valor=ent)
                    continue
                if "alvo" in passo:
                    self._ref(passo["alvo"], ent, ps + ("alvo",), refs)
                if passo["acao"] == "transicao":
                    ciclo = self.ciclos.get(ent)
                    if ciclo is None or passo["transicao"] not in ciclo["transicoes"]:
                        self.err("TESTE_TRANSICAO_INEXISTENTE", ps + ("transicao",),
                                 f"A transição '{passo['transicao']}' não existe em '{ent}'.", valor=passo["transicao"])
                if "dados" in passo:
                    self._dados(ent, passo["dados"], ps + ("dados",), refs)
                if passo["acao"] == "criar" and "ref" in passo:
                    registrar(passo["ref"], ent, ps + ("ref",))

            for vi, ver in enumerate(teste["esperado"].get("verificar", [])):
                pv = base + ("esperado", "verificar", vi)
                ref = ver["registro"][1:]
                if ref not in refs:
                    self.err("TESTE_REF_INDEFINIDA", pv + ("registro",), f"'{ver['registro']}' não foi criado neste teste.", valor=ver["registro"])
                elif ver["campo"] not in self.m.campos[refs[ref]]:
                    self.err("REF_CAMPO_INEXISTENTE", pv + ("campo",), f"O campo '{ver['campo']}' não existe em '{refs[ref]}'.", valor=ver["campo"])

    def _ref(self, valor: str, entidade_esperada: str, partes: tuple, refs: dict) -> None:
        ref = valor[1:]
        if ref not in refs:
            self.err("TESTE_REF_INDEFINIDA", partes, f"'{valor}' é usado antes de ser criado.", valor=valor)
        elif refs[ref] != entidade_esperada:
            self.err("TESTE_REF_ENTIDADE_INCOMPATIVEL", partes,
                     f"'{valor}' é um registro de '{refs[ref]}', mas aqui se espera '{entidade_esperada}'.",
                     valor=valor, entidade=refs[ref], esperado=entidade_esperada)

    def _dados(self, ent: str, dados: dict, partes: tuple, refs: dict) -> None:
        for chave, valor in dados.items():
            campo = self.m.campos[ent].get(chave)
            if campo is not None:
                if origem_do_campo(campo) != "usuario":
                    self.err("TESTE_CAMPO_PROTEGIDO", partes + (chave,),
                             f"'{ent}.{chave}' tem origem '{origem_do_campo(campo)}' e não pode ir em 'dados'; use 'forcar' na preparação.")
                else:
                    self._valor_de_campo(campo, valor, partes + (chave,))
                continue
            nav = self.m.navegacoes[ent].get(chave)
            if nav is not None and not nav.muitos:
                if isinstance(valor, str) and valor.startswith("@"):
                    self._ref(valor, nav.destino, partes + (chave,), refs)
                else:
                    self.err("TIPO_INCOMPATIVEL", partes + (chave,), f"'{chave}' é uma referência a '{nav.destino}'; use '@ref'.")
                continue
            self.err("REF_CAMPO_INEXISTENTE", partes + (chave,), f"'{chave}' não é campo nem referência de '{ent}'.", valor=chave)

    def _valor_de_campo(self, campo: dict, valor, partes: tuple) -> None:
        if campo["tipo"] == "opcoes" and valor not in campo["opcoes"]:
            self.err("VALOR_FORA_DAS_OPCOES", partes, f"'{valor}' não está nas opções {campo['opcoes']}.", valor=valor, opcoes=campo["opcoes"])
        elif campo["tipo"] in ("data", "data_hora") and not _data_valida(valor, campo["tipo"] == "data_hora"):
            self.err("DATA_INVALIDA", partes, f"'{valor}' não é uma data válida para '{campo['id']}' ({campo['tipo']}).", valor=valor)
