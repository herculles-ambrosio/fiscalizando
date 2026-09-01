import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SeletorExercicio({
  exercicios,
  valor,
  aoTrocar,
}: {
  exercicios: number[];
  valor: number | null;
  aoTrocar: (ano: number) => void;
}) {
  if (!exercicios.length) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Exercício</span>
      <Select value={valor ? String(valor) : ""} onValueChange={(v) => aoTrocar(Number(v))}>
        <SelectTrigger className="h-9 w-32">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {exercicios.map((a) => (
            <SelectItem key={a} value={String(a)}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
