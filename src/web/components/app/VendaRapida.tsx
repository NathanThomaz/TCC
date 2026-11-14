import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Loader2, Mic, MicOff, ScanBarcode, Sparkles } from "lucide-react";
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

interface Detector {
  detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
type ConstrutorDetector = new (o?: { formats?: string[] }) => Detector;

function detectorDeCodigo(): ConstrutorDetector | null {
  return (window as unknown as { BarcodeDetector?: ConstrutorDetector }).BarcodeDetector ?? null;
}

/**
 * Campo "Ler código de barras": o leitor USB digita o código e um Enter; a câmera (onde o
 * navegador lê códigos, como o Chrome no celular) faz o mesmo sem o leitor.
 */
export function LeitorCodigo({
  onCodigo,
  id = "leitor-codigo",
}: {
  onCodigo: (codigo: string) => void;
  id?: string;
}) {
  const [codigo, setCodigo] = useState("");
  const [camera, setCamera] = useState(false);
  const temCamera =
    typeof window !== "undefined" &&
    detectorDeCodigo() !== null &&
    !!navigator.mediaDevices?.getUserMedia;
  const enviar = (c: string) => {
    const limpo = c.trim();
    if (limpo) onCodigo(limpo);
    setCodigo("");
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor={id} className="flex items-center gap-2">
          <ScanBarcode className="size-4" aria-hidden /> Ler código de barras
        </Label>
        <Input
          id={id}
          value={codigo}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Passe o leitor ou digite e tecle Enter"
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              enviar(codigo);
            }
          }}
        />
      </div>
      {temCamera && (
        <Button type="button" variant="outline" onClick={() => setCamera(true)}>
          <Camera aria-hidden /> Câmera
        </Button>
      )}
      {camera && (
        <CameraCodigo
          onLido={(c) => {
            setCamera(false);
            enviar(c);
          }}
          onFechar={() => setCamera(false)}
        />
      )}
    </div>
  );
}

function CameraCodigo({ onLido, onFechar }: { onLido: (c: string) => void; onFechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  // A câmera abre uma vez; o aviso de leitura usa sempre a função mais recente.
  const aoLer = useRef(onLido);
  useEffect(() => {
    aoLer.current = onLido;
  }, [onLido]);
  useEffect(() => {
    const Construtor = detectorDeCodigo();
    if (!Construtor) return;
    const detector = new Construtor({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
    });
    let fluxo: MediaStream | null = null;
    let parado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
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
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (f) => {
        fluxo = f;
        // O diálogo fechou antes de a câmera abrir: solta a câmera na hora.
        if (parado || !video.current) return f.getTracks().forEach((t) => t.stop());
        video.current.srcObject = f;
        await video.current.play();
        void procurar();
      })
      .catch(() => setErro("Não foi possível abrir a câmera. Confira a permissão do navegador."));
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
          <DialogDescription>
            O produto entra na venda assim que o código for lido.
          </DialogDescription>
        </DialogHeader>
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : (
          <video ref={video} muted playsInline className="w-full rounded-lg bg-black" />
        )}
      </DialogContent>
    </Dialog>
  );
}
