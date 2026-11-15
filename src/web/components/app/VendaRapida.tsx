import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Loader2, Mic, MicOff, ScanBarcode, Sparkles, Usb } from "lucide-react";
import type { VendaInterpretadaDto } from "../../../shared/api";
import { interpretarVenda } from "@/api/operacao";
import { ErroApi } from "@/components/app/Comum";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { criarDetector, motivoCamera, temCamera } from "@/lib/leitorCodigo";

// Menos digitação na venda (pedido do dono, 2026-11-14): ditar ou escrever a venda (a IA monta o
// rascunho para conferir) e ler o código de barras com leitor USB ou pela câmera do celular.

// ---- Ditado pelo microfone (Web Speech API; só onde o navegador oferece) ----

interface Reconhecimento {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type ConstrutorReconhecimento = new () => Reconhecimento;

function reconhecimentoDeVoz(): ConstrutorReconhecimento | null {
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * "Diga ou escreva a venda": a IA liga o texto aos produtos e clientes cadastrados e a tela
 * preenche o rascunho. Nada é salvo antes de a pessoa conferir.
 */
export function VendaDitada({
  sistema,
  onMontada,
}: {
  sistema: string;
  onMontada: (venda: VendaInterpretadaDto) => void;
}) {
  const [texto, setTexto] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const voz = useRef<Reconhecimento | null>(null);
  const Construtor = typeof window === "undefined" ? null : reconhecimentoDeVoz();
  const m = useMutation({
    mutationFn: () => interpretarVenda(sistema, texto.trim()),
    onSuccess: onMontada,
  });
  useEffect(() => () => voz.current?.stop(), []);

  function alternarMicrofone() {
    if (ouvindo) return voz.current?.stop();
    if (!Construtor) return;
    const r = new Construtor();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const falado = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (falado) setTexto((t) => (t ? `${t} ${falado}` : falado));
    };
    r.onend = () => setOuvindo(false);
    r.onerror = () => setOuvindo(false);
    voz.current = r;
    setOuvindo(true);
    r.start();
  }

  return (
    <section
      aria-labelledby="venda-ditada"
      className="space-y-2 rounded-lg border border-primary/30 bg-accent/40 p-4"
    >
      <Label htmlFor="venda-ditada-texto" id="venda-ditada" className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden /> Diga ou escreva a venda
      </Label>
      <p className="text-xs text-muted-foreground">
        Ex.: “2 caixas de cerveja lata e 3 águas para o Bar do Zé, no Pix”. O assistente monta o
        rascunho abaixo; você confere antes de salvar.
      </p>
      <Textarea
        id="venda-ditada-texto"
        rows={2}
        maxLength={1000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="O que foi vendido, para quem e como pagou"
      />
      <ErroApi erro={m.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={texto.trim().length < 3 || m.isPending}
          onClick={() => m.mutate()}
        >
          {m.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Sparkles aria-hidden />
          )}
          Montar venda
        </Button>
        {Construtor && (
          <Button
            type="button"
            variant="outline"
            aria-pressed={ouvindo}
            onClick={alternarMicrofone}
          >
            {ouvindo ? <MicOff aria-hidden /> : <Mic aria-hidden />}
            {ouvindo ? "Parar" : "Falar"}
          </Button>
        )}
      </div>
    </section>
  );
}

// ---- Código de barras ----

/**
 * Botão pequeno da câmera: pede a permissão, lê o código e devolve. Aparece onde o navegador
 * oferece câmera; sem o leitor nativo, a biblioteca de leitura é baixada ao abrir.
 */
export function BotaoCamera({
  onLido,
  descricao,
}: {
  onLido: (codigo: string) => void;
  descricao: string;
}) {
  const [aberta, setAberta] = useState(false);
  if (!temCamera()) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Ler com a câmera"
        title="Ler com a câmera"
        onClick={() => setAberta(true)}
      >
        <Camera aria-hidden />
      </Button>
      {aberta && (
        <CameraCodigo
          descricao={descricao}
          onLido={(c) => {
            setAberta(false);
            onLido(c);
          }}
          onFechar={() => setAberta(false)}
        />
      )}
    </>
  );
}

/**
 * Campo "Ler código de barras": o leitor USB funciona como teclado (digita o código e um Enter),
 * então basta o campo estar selecionado; o botão do leitor faz isso e avisa que está pronto. A
 * câmera faz o mesmo sem o leitor.
 */
export function LeitorCodigo({
  onCodigo,
  id = "leitor-codigo",
}: {
  onCodigo: (codigo: string) => void;
  id?: string;
}) {
  const [codigo, setCodigo] = useState("");
  const [pronto, setPronto] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const enviar = (c: string) => {
    const limpo = c.trim();
    if (limpo) onCodigo(limpo);
    setCodigo("");
  };
  return (
    <div className="min-w-56 flex-1 space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-2">
        <ScanBarcode className="size-4" aria-hidden /> Ler código de barras
      </Label>
      <div className="flex gap-2">
        <Input
          ref={campo}
          id={id}
          value={codigo}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Passe o leitor ou digite e tecle Enter"
          aria-describedby={`${id}-dica`}
          onFocus={() => setPronto(true)}
          onBlur={() => setPronto(false)}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              enviar(codigo);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Usar o leitor USB"
          title="Usar o leitor USB"
          onClick={() => campo.current?.focus()}
        >
          <Usb aria-hidden />
        </Button>
        <BotaoCamera
          descricao="O produto entra na venda assim que o código for lido."
          onLido={enviar}
        />
      </div>
      <p id={`${id}-dica`} className="text-xs text-muted-foreground" aria-live="polite">
        {pronto
          ? "Leitor pronto: passe o código do produto no leitor."
          : "Leitor USB, câmera ou digitação."}
      </p>
    </div>
  );
}

function CameraCodigo({
  descricao,
  onLido,
  onFechar,
}: {
  descricao: string;
  onLido: (c: string) => void;
  onFechar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  // A câmera abre uma vez; o aviso de leitura usa sempre a função mais recente.
  const aoLer = useRef(onLido);
  useEffect(() => {
    aoLer.current = onLido;
  }, [onLido]);
  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let parado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abrir = async () => {
      try {
        // A biblioteca baixa enquanto o navegador pede a permissão; a câmera fica guardada antes
        // de esperá-la, para ser solta mesmo se a biblioteca falhar.
        const pronto = criarDetector();
        pronto.catch(() => undefined);
        const f = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        fluxo = f;
        // O diálogo fechou antes de a câmera abrir: solta a câmera na hora.
        if (parado || !video.current) return f.getTracks().forEach((t) => t.stop());
        video.current.srcObject = f;
        await video.current.play();
        const detector = await pronto;
        setLendo(true);
        const procurar = async () => {
          if (parado || !video.current) return;
          try {
            const achados = await detector.detect(video.current);
            if (achados[0]?.rawValue) return aoLer.current(achados[0].rawValue);
          } catch {
            // quadro ainda sem imagem: tenta de novo
          }
          timer = setTimeout(() => void procurar(), 300);
        };
        void procurar();
      } catch (e) {
        fluxo?.getTracks().forEach((t) => t.stop());
        if (!parado) setErro(motivoCamera(e));
      }
    };
    void abrir();
    return () => {
      parado = true;
      clearTimeout(timer);
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aponte para o código de barras</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : (
          <>
            <video ref={video} muted playsInline className="w-full rounded-lg bg-black" />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {lendo
                ? "Procurando o código… Deixe-o inteiro e nítido na imagem."
                : "Pedindo permissão para usar a câmera…"}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
