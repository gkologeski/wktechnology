import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  searchSignerContacts,
  createSignerContact,
} from "@/lib/contracts/signer-contacts.functions";
import type { SignerContact } from "@/lib/contracts/signers";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailInput } from "@/components/ui/email-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emailSchema } from "@/lib/email-schema";
export function SignerContactPicker({
  role,
  value,
  onChange,
  disabled,
  partyName,
  partyKind,
}: {
  role: string;
  value: SignerContact | null;
  onChange: (v: SignerContact | null) => void;
  disabled?: boolean;
  partyName?: string | null;
  partyKind?: "company" | "person";
}) {
  const p = usePermissions(),
    search = useServerFn(searchSignerContacts),
    create = useServerFn(createSignerContact);
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState("");
  const writable = !disabled && !readViewAs()?.readOnly && readViewAs()?.mode !== "role";
  const view = p.canAny(["own", "team", "workspace"].map((s) => `techsales.contacts.view.${s}`));
  const canCreate =
    writable &&
    view &&
    p.canAny(["own", "team", "workspace"].map((s) => `techsales.contacts.create.${s}`));
  const q = useQuery({
    queryKey: ["signer-contacts", p.workspaceId, query],
    queryFn: () => search({ data: { query } }),
    enabled: view && !disabled && !value && query.trim().length >= 2,
    staleTime: 15000,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: () => create({ data: { name, email } }),
    onSuccess: (r) => {
      onChange(r);
      setOpen(false);
      setQuery("");
      setName("");
      setEmail("");
    },
  });
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="space-y-0.5">
        <Label>{role}</Label>
        {partyName && partyKind !== "person" && (
          <p className="text-xs text-muted-foreground">
            Representante legal de <span className="font-medium text-foreground">{partyName}</span>
          </p>
        )}
        {partyKind === "person" && (
          <p className="text-xs text-muted-foreground">Assinatura por pessoa física</p>
        )}
      </div>
      {value ? (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {value.email || "Contato sem e-mail: atualize o cadastro antes de preparar."}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={!writable}
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
          >
            Trocar
          </Button>
        </div>
      ) : (
        <>
          <Input
            aria-label={`Buscar contato para ${role}`}
            placeholder="Pesquisar nome ou e-mail"
            value={query}
            disabled={!writable || !view}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!view && (
            <p className="text-sm text-muted-foreground">
              Solicite permissão para consultar contatos.
            </p>
          )}
          {q.isFetching && (
            <p role="status" className="text-sm">
              Pesquisando…
            </p>
          )}
          {q.isError && (
            <div role="alert" className="text-sm">
              Falha na pesquisa.{" "}
              <Button variant="link" onClick={() => q.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {q.data && query.trim().length >= 2 && (
            <div
              className="max-h-40 overflow-y-auto"
              role="listbox"
              aria-label={`Contatos para ${role}`}
            >
              {q.data.map((c) => (
                <Button
                  role="option"
                  aria-selected={false}
                  key={c.id}
                  variant="ghost"
                  className="h-auto w-full justify-start text-left"
                  disabled={!writable || !emailSchema(255).safeParse(c.email).success}
                  onClick={() => onChange(c)}
                >
                  <span>
                    {c.name}
                    <span className="block text-xs text-muted-foreground">
                      {c.email || "Sem e-mail — atualize o contato"}
                    </span>
                  </span>
                </Button>
              ))}
              {!q.data.length && (
                <p className="text-sm text-muted-foreground">Nenhum contato encontrado.</p>
              )}
            </div>
          )}
          {canCreate && query.trim().length >= 2 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setName(query.includes("@") ? "" : query);
                setEmail(query.includes("@") ? query : "");
                setOpen(true);
              }}
            >
              + Cadastrar contato nesta busca
            </Button>
          )}
        </>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!mutation.isPending) setOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar contato para {role}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="signer-new-name">Nome completo</Label>
          <Input
            id="signer-new-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
          />
          <Label>E-mail para assinatura</Label>
          <EmailInput value={email} onChange={setEmail} />
          {mutation.isError && <p role="alert">{mutation.error.message}</p>}
          <Button
            disabled={
              !canCreate ||
              mutation.isPending ||
              name.trim().length < 2 ||
              !emailSchema(255).safeParse(email).success
            }
            onClick={() => mutation.mutate()}
          >
            Salvar e selecionar contato
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
