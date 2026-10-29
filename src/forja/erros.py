"""Erros de validação do mapa: estrutura, catálogo de códigos e ordenação determinística."""

from __future__ import annotations

from dataclasses import dataclass, field

# Códigos estruturais vêm do JSON Schema e são gerados como "ESQUEMA_<palavra-chave>"
# (ex.: ESQUEMA_REQUIRED). Todos os demais precisam constar deste catálogo.
PREFIXO_ESQUEMA = "ESQUEMA_"

CATALOGO: dict[str, tuple[str, str]] = {
    # código: (severidade, descrição)
    "VERSAO_NAO_SUPORTADA": ("erro", "versao_mapa diferente da versão do contrato"),
    "DATA_INVALIDA": ("erro", "data ou data-hora fora do formato ISO 8601"),
    # identificadores
    "ID_DUPLICADO": ("erro", "identificador repetido no mesmo conjunto"),
    "NOME_CONFLITANTE": ("erro", "nome de relacionamento igual a campo ou a outro relacionamento da entidade"),
    # referências
    "REF_ENTIDADE_INEXISTENTE": ("erro", "entidade citada não existe"),
    "REF_CAMPO_INEXISTENTE": ("erro", "campo citado não existe na entidade"),
    "REF_RELACIONAMENTO_INEXISTENTE": ("erro", "relacionamento citado não existe"),
    "REF_TELA_INEXISTENTE": ("erro", "tela citada no menu não existe"),
    "REF_REGRA_INEXISTENTE": ("erro", "regra citada não existe"),
    "REF_ESTADO_INEXISTENTE": ("erro", "estado citado não existe no ciclo de vida"),
    "REF_TRANSICAO_INEXISTENTE": ("erro", "transição citada não existe no ciclo de vida"),
    # caminhos
    "CAMINHO_INVALIDO": ("erro", "caminho não percorre campos e relacionamentos válidos"),
    "COLECAO_ONDE_SE_ESPERA_VALOR": ("erro", "caminho termina numa coleção onde se espera um valor"),
    "AGREGACAO_SEM_COLECAO": ("erro", "agregação sobre algo que não é coleção"),
    "AGREGACAO_SEM_EXPRESSAO": ("erro", "soma, mínimo ou máximo sem o valor a agregar"),
    "PARA_CADA_INVALIDO": ("erro", "para_cada não aponta para uma coleção"),
    # tipos
    "TIPO_INCOMPATIVEL": ("erro", "operação entre tipos incompatíveis"),
    "CONDICAO_NAO_BOOLEANA": ("erro", "condição ou filtro que não resulta em verdadeiro/falso"),
    "VALOR_FORA_DAS_OPCOES": ("erro", "valor não pertence à lista de opções do campo"),
    "CALCULO_TIPO_INCOMPATIVEL": ("erro", "expressão do cálculo incompatível com o tipo do campo"),
    "ACAO_TIPO_INCOMPATIVEL": ("erro", "valor da ação incompatível com o campo alvo"),
    # cálculos
    "CALCULADO_SEM_REGRA": ("erro", "campo de origem 'calculo' sem regra de cálculo"),
    "CALCULO_DUPLICADO": ("erro", "mais de uma regra de cálculo para o mesmo campo"),
    "CALCULO_EM_CAMPO_NAO_CALCULADO": ("erro", "regra de cálculo em campo que não tem origem 'calculo'"),
    "CICLO_DE_CALCULO": ("erro", "cálculos que dependem uns dos outros em círculo"),
    # ações
    "ACAO_ALTERA_CALCULADO": ("erro", "ação alterando campo de origem 'calculo'"),
    "ACAO_ALTERA_ESTADO": ("erro", "ação alterando campo de estado (só transições o alteram)"),
    "CAMPO_ACAO_SEM_ACAO": ("erro", "campo de origem 'acao' que nenhuma ação altera"),
    "REVERTER_EM_TRANSICAO": ("erro", "reverter_ao_excluir em ação disparada por transição"),
    "ACAO_EM_EDICAO_NAO_SUPORTADA": ("erro", "ação disparada por edição (não suportada no MVP, P3)"),
    # regras
    "REGRA_DUPLICADA": ("erro", "id de regra repetido"),
    "REGRA_EQUIVALENTE": ("aviso", "regra idêntica a outra, exceto id e textos"),
    # ciclo de vida
    "CAMPO_ESTADO_INVALIDO": ("erro", "campo de estado incoerente com o ciclo de vida"),
    "ESTADO_INICIAL_INEXISTENTE": ("erro", "estado inicial não está entre os estados"),
    "TRANSICAO_DE_ESTADO_FINAL": ("erro", "transição saindo de estado final"),
    "ESTORNO_INVALIDO": ("erro", "transição de estorno incoerente com a transição estornada"),
    "EXCLUSAO_COM_EFEITOS": ("erro", "estado alcançado por transição com efeitos permite exclusão"),
    "GATILHO_SEM_CICLO": ("erro", "regra disparada por transição em entidade sem ciclo de vida"),
    "DETALHE_INVALIDO": ("erro", "detalhe não é relacionamento que parte da entidade"),
    "ESTADO_INALCANCAVEL": ("aviso", "estado que nenhuma transição alcança a partir do inicial"),
    # perfis
    "PERFIL_ENTIDADE_INEXISTENTE": ("erro", "perfil cita entidade inexistente"),
    "PERFIL_SEM_ENTIDADE": ("aviso", "entidade que nenhum perfil cita"),
    # testes de aceitação
    "TESTE_REF_INDEFINIDA": ("erro", "@ref usada antes de ser criada"),
    "TESTE_REF_ENTIDADE_INCOMPATIVEL": ("erro", "@ref aponta para registro de outra entidade"),
    "TESTE_CAMPO_PROTEGIDO": ("erro", "campo protegido em 'dados' (use 'forcar' na preparação)"),
    "FORCAR_CAMPO_DE_USUARIO": ("erro", "'forcar' em campo de origem 'usuario'"),
    "TESTE_TRANSICAO_INEXISTENTE": ("erro", "passo de teste com transição inexistente na entidade"),
    # compatibilidade
    "CAMPO_CALCULADO_OBSOLETO": ("aviso", "'calculado: true' é obsoleto; use origem 'calculo'"),
}


@dataclass(frozen=True)
class ErroValidacao:
    codigo: str
    caminho: str
    mensagem: str
    severidade: str
    camada: str
    detalhes: dict = field(default_factory=dict, compare=False)

    def como_dict(self) -> dict:
        return {
            "codigo": self.codigo,
            "caminho": self.caminho,
            "mensagem": self.mensagem,
            "severidade": self.severidade,
            "camada": self.camada,
            "detalhes": self.detalhes,
        }


def novo(codigo: str, caminho: str, mensagem: str, camada: str = "semantica", **detalhes) -> ErroValidacao:
    """Cria um erro do catálogo; a severidade vem do catálogo, nunca do chamador."""
    if codigo not in CATALOGO:
        raise KeyError(f"código fora do catálogo: {codigo}")
    return ErroValidacao(codigo, caminho, mensagem, CATALOGO[codigo][0], camada, detalhes)


def ponteiro(*partes) -> str:
    """JSON Pointer (RFC 6901) a partir de chaves e índices."""
    if not partes:
        return ""
    return "".join("/" + str(p).replace("~", "~0").replace("/", "~1") for p in partes)


def _chave_ponteiro(caminho: str) -> tuple:
    tokens = caminho.split("/")[1:] if caminho else []
    return tuple((0, int(t), "") if t.isdigit() else (1, 0, t) for t in tokens)


def ordenar(erros) -> list[ErroValidacao]:
    """Ordem determinística: caminho (índices numéricos em ordem numérica), código, mensagem."""
    return sorted(erros, key=lambda e: (_chave_ponteiro(e.caminho), e.codigo, e.mensagem))
