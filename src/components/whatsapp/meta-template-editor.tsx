import { useState, type FormEvent } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  collectTemplateVariables,
  buildMetaTemplateComponents,
} from "@/lib/whatsapp/meta-template-definition";
import type { MetaTemplateDraft, MetaTemplateTarget } from "@/lib/whatsapp/meta-template-types";
import { MetaTemplatePreview } from "./meta-template-preview";

type UploadSample = { appId: string; file: File };
const SELECT =
  "flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50";
function message(error: unknown) {
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues))
    return String(error.issues[0]?.message || "Revise os campos do modelo.");
  return error instanceof Error ? error.message : "Não foi possível validar o modelo.";
}
export function MetaTemplateEditor({
  initial,
  mode,
  target,
  pending,
  canSubmit,
  error,
  onCancel,
  onSubmit,
  onUpload,
}: {
  initial: MetaTemplateDraft;
  mode: "create" | "update";
  target: MetaTemplateTarget;
  pending: boolean;
  canSubmit: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (draft: MetaTemplateDraft) => void;
  onUpload: (sample: UploadSample) => Promise<{ handle: string }>;
}) {
  const [draft, setDraft] = useState<MetaTemplateDraft>(() => structuredClone(initial));
  const [validation, setValidation] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [appId, setAppId] = useState("");
  const [sample, setSample] = useState<File | null>(null);
  const patch = (change: Partial<MetaTemplateDraft>) =>
    setDraft((current) => ({ ...current, ...change }));
  let variables: string[] = [],
    variablesError: string | null = null;
  if (draft.category !== "AUTHENTICATION") {
    try {
      variables = collectTemplateVariables(draft.body, draft.parameterFormat);
    } catch (error) {
      variablesError = message(error);
    }
  }
  const locked = pending || uploading || !canSubmit;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (locked) return;
    try {
      buildMetaTemplateComponents(draft);
      setValidation(null);
      onSubmit(draft);
    } catch (error) {
      setValidation(message(error));
    }
  };
  const upload = async () => {
    if (locked || !sample || target.provider !== "cloud") return;
    setUploadError(null);
    const allowed =
      draft.headerFormat === "IMAGE"
        ? ["image/jpeg", "image/png"]
        : draft.headerFormat === "VIDEO"
          ? ["video/mp4"]
          : ["application/pdf"];
    const max = draft.headerFormat === "IMAGE" ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
    if (!/^\d{5,30}$/.test(appId.trim())) {
      setUploadError("Informe o ID público do aplicativo Meta usado nesta conexão.");
      return;
    }
    if (!allowed.includes(sample.type) || sample.size === 0 || sample.size > max) {
      setUploadError(
        `Use ${draft.headerFormat === "IMAGE" ? "PNG ou JPEG de até 5 MB" : draft.headerFormat === "VIDEO" ? "MP4 de até 16 MB" : "PDF de até 16 MB"}.`,
      );
      return;
    }
    setUploading(true);
    try {
      const result = await onUpload({ appId: appId.trim(), file: sample });
      patch({ headerHandle: result.handle });
      setSample(null);
    } catch (error) {
      setUploadError(message(error));
    } finally {
      setUploading(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Formulário de modelo Meta">
      <p className="rounded-lg bg-muted/50 p-3 text-sm">
        {mode === "update"
          ? "A alteração pode passar por nova análise e interromper o uso do modelo aprovado."
          : "O modelo será enviado à Meta para análise; isso não envia mensagens."}{" "}
        A alteração vale para a conta WhatsApp Business e seus números compartilhados.
      </p>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <fieldset disabled={locked} className="min-w-0 space-y-4">
          <div>
            <Label htmlFor="meta-template-name">Nome do modelo</Label>
            <Input
              id="meta-template-name"
              value={draft.name}
              disabled={mode === "update"}
              maxLength={512}
              placeholder="aviso_atualizacao_techerp"
              onChange={(e) => patch({ name: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use letras minúsculas, números e sublinhado. Nome e idioma identificam a versão na
              Meta.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="meta-template-language">Idioma da Meta</Label>
              <Input
                id="meta-template-language"
                value={draft.language}
                disabled={mode === "update"}
                maxLength={20}
                placeholder="pt_BR"
                onChange={(e) => patch({ language: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="meta-template-category">Categoria</Label>
              <select
                id="meta-template-category"
                className={SELECT}
                value={draft.category}
                onChange={(e) =>
                  patch({ category: e.target.value as MetaTemplateDraft["category"] })
                }
              >
                <option
                  value="UTILITY"
                  disabled={mode === "update" && initial.category === "AUTHENTICATION"}
                >
                  Utilidade
                </option>
                <option
                  value="MARKETING"
                  disabled={mode === "update" && initial.category === "AUTHENTICATION"}
                >
                  Marketing
                </option>
                <option
                  value="AUTHENTICATION"
                  disabled={mode === "update" && initial.category !== "AUTHENTICATION"}
                >
                  Autenticação · copiar código
                </option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A Meta pode reclassificar utilidade como marketing. A NOTIFICA-CENTRAL aceita somente
            modelos de utilidade compatíveis com seus avisos neutros.
          </p>
          {draft.category === "AUTHENTICATION" ? (
            <div className="space-y-4 rounded-lg bg-muted/30 p-4">
              <p className="text-sm">
                Modelo padronizado de autenticação com botão de copiar código. O texto final é
                definido pela Meta no idioma informado.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.authentication.securityRecommendation}
                  onChange={(e) =>
                    patch({
                      authentication: {
                        ...draft.authentication,
                        securityRecommendation: e.target.checked,
                      },
                    })
                  }
                />
                Incluir recomendação de segurança
              </label>
              <div>
                <Label htmlFor="meta-auth-expiration">Validade em minutos (opcional)</Label>
                <Input
                  id="meta-auth-expiration"
                  type="number"
                  min={1}
                  max={90}
                  value={draft.authentication.expiresMinutes ?? ""}
                  onChange={(e) =>
                    patch({
                      authentication: {
                        ...draft.authentication,
                        expiresMinutes: e.target.value === "" ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="meta-auth-button">Texto do botão copiar código</Label>
                <Input
                  id="meta-auth-button"
                  value={draft.authentication.buttonText}
                  maxLength={25}
                  onChange={(e) =>
                    patch({
                      authentication: { ...draft.authentication, buttonText: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="meta-template-format">Formato das variáveis</Label>
                <select
                  id="meta-template-format"
                  className={SELECT}
                  disabled={mode === "update"}
                  value={draft.parameterFormat}
                  onChange={(e) =>
                    patch({
                      parameterFormat: e.target.value as MetaTemplateDraft["parameterFormat"],
                      bodyExamples: {},
                    })
                  }
                >
                  <option value="POSITIONAL">
                    Posicional: {"{{1}}"}, {"{{2}}"}
                  </option>
                  <option value="NAMED" disabled={target.provider !== "cloud"}>
                    Nomeado: {"{{nome}}"}
                  </option>
                </select>
              </div>
              <div>
                <Label htmlFor="meta-template-header-format">Cabeçalho</Label>
                <select
                  id="meta-template-header-format"
                  className={SELECT}
                  value={draft.headerFormat}
                  onChange={(e) => {
                    patch({
                      headerFormat: e.target.value as MetaTemplateDraft["headerFormat"],
                      headerHandle: "",
                      headerText: "",
                      headerExample: "",
                    });
                    setSample(null);
                    setUploadError(null);
                  }}
                >
                  <option value="NONE">Sem cabeçalho</option>
                  <option value="TEXT">Texto</option>
                  <option value="IMAGE" disabled={target.provider !== "cloud"}>
                    Imagem
                  </option>
                  <option value="VIDEO" disabled={target.provider !== "cloud"}>
                    Vídeo
                  </option>
                  <option value="DOCUMENT" disabled={target.provider !== "cloud"}>
                    Documento PDF
                  </option>
                </select>
              </div>
              {draft.headerFormat === "TEXT" && (
                <>
                  <div>
                    <Label htmlFor="meta-template-header">Texto do cabeçalho</Label>
                    <Input
                      id="meta-template-header"
                      value={draft.headerText}
                      maxLength={60}
                      onChange={(e) => patch({ headerText: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="meta-template-header-example">
                      Exemplo da variável do cabeçalho, se houver
                    </Label>
                    <Input
                      id="meta-template-header-example"
                      value={draft.headerExample}
                      onChange={(e) => patch({ headerExample: e.target.value })}
                    />
                  </div>
                </>
              )}
              {["IMAGE", "VIDEO", "DOCUMENT"].includes(draft.headerFormat) && (
                <div className="space-y-3 rounded-lg bg-muted/30 p-4">
                  <p className="text-sm">
                    Envie uma amostra fictícia para análise da Meta. O arquivo não é uma mensagem
                    nem um anexo de conversa.
                  </p>
                  <div>
                    <Label htmlFor="meta-upload-app">ID público do aplicativo Meta</Label>
                    <Input
                      id="meta-upload-app"
                      value={appId}
                      inputMode="numeric"
                      onChange={(e) => setAppId(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="meta-template-sample">Arquivo de amostra</Label>
                    <Input
                      id="meta-template-sample"
                      type="file"
                      accept={
                        draft.headerFormat === "IMAGE"
                          ? "image/png,image/jpeg"
                          : draft.headerFormat === "VIDEO"
                            ? "video/mp4"
                            : "application/pdf"
                      }
                      onChange={(e) => {
                        setSample(e.target.files?.[0] ?? null);
                        patch({ headerHandle: "" });
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!sample || locked || target.provider !== "cloud"}
                    onClick={() => void upload()}
                  >
                    <Upload className="mr-2 size-4" />
                    {uploading ? "Enviando amostra…" : "Enviar amostra para a Meta"}
                  </Button>
                  {draft.headerHandle && (
                    <p role="status" className="text-sm">
                      Amostra anexada à definição do modelo.
                    </p>
                  )}
                  {uploadError && (
                    <p role="alert" className="text-sm text-destructive">
                      {uploadError}
                    </p>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="meta-template-body">Corpo da mensagem</Label>
                <Textarea
                  id="meta-template-body"
                  value={draft.body}
                  maxLength={1024}
                  rows={6}
                  onChange={(e) => patch({ body: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.body.length}/1024 caracteres · Não use dados pessoais reais nos exemplos.
                </p>
              </div>
              {variablesError && (
                <p role="alert" className="text-sm text-destructive">
                  {variablesError}
                </p>
              )}
              {variables.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Exemplos das variáveis para análise</p>
                  {variables.map((variable) => (
                    <div key={variable}>
                      <Label htmlFor={`meta-body-example-${variable}`}>
                        Exemplo {`{{${variable}}}`}
                      </Label>
                      <Input
                        id={`meta-body-example-${variable}`}
                        value={
                          Object.prototype.hasOwnProperty.call(draft.bodyExamples, variable)
                            ? draft.bodyExamples[variable]
                            : ""
                        }
                        onChange={(e) =>
                          patch({
                            bodyExamples: { ...draft.bodyExamples, [variable]: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <Label htmlFor="meta-template-footer">Rodapé (opcional)</Label>
                <Input
                  id="meta-template-footer"
                  value={draft.footer}
                  maxLength={60}
                  onChange={(e) => patch({ footer: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Botões</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={draft.buttons.length >= 10}
                    onClick={() =>
                      patch({ buttons: [...draft.buttons, { type: "QUICK_REPLY", text: "" }] })
                    }
                  >
                    <Plus className="mr-1 size-4" />
                    Adicionar botão
                  </Button>
                </div>
                {draft.buttons.map((button, index) => (
                  <div className="space-y-3 rounded-lg bg-muted/30 p-3" key={index}>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`meta-button-type-${index}`} className="sr-only">
                        Tipo do botão {index + 1}
                      </Label>
                      <select
                        id={`meta-button-type-${index}`}
                        className={SELECT}
                        value={button.type}
                        onChange={(e) =>
                          patch({
                            buttons: draft.buttons.map((entry, i) =>
                              i === index
                                ? { type: e.target.value as typeof button.type, text: entry.text }
                                : entry,
                            ),
                          })
                        }
                      >
                        <option value="QUICK_REPLY">Resposta rápida</option>
                        <option value="URL">Abrir URL</option>
                        <option value="PHONE_NUMBER">Ligar para telefone</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover botão ${index + 1}`}
                        onClick={() =>
                          patch({ buttons: draft.buttons.filter((_, i) => i !== index) })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div>
                      <Label htmlFor={`meta-button-text-${index}`}>
                        Texto do botão {index + 1}
                      </Label>
                      <Input
                        id={`meta-button-text-${index}`}
                        value={button.text}
                        maxLength={25}
                        onChange={(e) =>
                          patch({
                            buttons: draft.buttons.map((entry, i) =>
                              i === index ? { ...entry, text: e.target.value } : entry,
                            ),
                          })
                        }
                      />
                    </div>
                    {button.type === "URL" && (
                      <>
                        <div>
                          <Label htmlFor={`meta-button-url-${index}`}>
                            URL do botão {index + 1}
                          </Label>
                          <Input
                            id={`meta-button-url-${index}`}
                            value={button.url ?? ""}
                            placeholder="https://"
                            onChange={(e) =>
                              patch({
                                buttons: draft.buttons.map((entry, i) =>
                                  i === index ? { ...entry, url: e.target.value } : entry,
                                ),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`meta-button-example-${index}`}>
                            Exemplo da parte variável da URL, se houver
                          </Label>
                          <Input
                            id={`meta-button-example-${index}`}
                            value={button.example ?? ""}
                            onChange={(e) =>
                              patch({
                                buttons: draft.buttons.map((entry, i) =>
                                  i === index ? { ...entry, example: e.target.value } : entry,
                                ),
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                    {button.type === "PHONE_NUMBER" && (
                      <div>
                        <Label htmlFor={`meta-button-phone-${index}`}>
                          Telefone do botão {index + 1}, com país
                        </Label>
                        <PhoneInput
                          id={`meta-button-phone-${index}`}
                          value={button.phoneNumber ?? ""}
                          disabled={locked}
                          onChange={(phoneNumber) =>
                            patch({
                              buttons: draft.buttons.map((entry, i) =>
                                i === index ? { ...entry, phoneNumber } : entry,
                              ),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </fieldset>
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <MetaTemplatePreview draft={draft} />
        </div>
      </div>
      {(validation || error) && (
        <p role="alert" className="text-sm text-destructive">
          {validation || error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending || uploading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={locked}>
          {pending
            ? "Enviando à Meta…"
            : mode === "update"
              ? "Enviar alteração à Meta"
              : "Criar modelo na Meta"}
        </Button>
      </div>
    </form>
  );
}
