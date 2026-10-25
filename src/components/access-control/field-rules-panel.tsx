import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccessBundle, type FieldRuleRow } from "@/lib/access-control/access.functions";
import { SHARED_FIELD_OPTIONS } from "@/lib/access-control/shared-field-catalog";
import { FieldRuleEditorDialog } from "./access-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function canonicalField(rule: FieldRuleRow) {
  if (rule.resource === "techhire.offers" && rule.field === "amount") return "salary_amount";
  if (rule.resource === "techhire.interviews" && rule.field === "private_notes") return "notes";
  return rule.field;
}
export function FieldRulesPanel() {
  const get = useServerFn(getAccessBundle);
  const query = useQuery({ queryKey: ["access", "bundle"], queryFn: () => get() });
  const [selected, setSelected] = useState<FieldRuleRow | null>(null);
  const [open, setOpen] = useState(false);
  const data = query.data;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Proteção de campos</CardTitle>
          <CardDescription>
            Ocultação, máscara e somente leitura por cargo ou conjunto de permissões. Regras do
            sistema são preservadas.
          </CardDescription>
        </div>
        {data?.can_manage && (
          <Button
            onClick={() => {
              setSelected(null);
              setOpen(true);
            }}
          >
            Nova regra
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <p>Carregando regras…</p>
        ) : query.isError ? (
          <p role="alert">Não foi possível consultar as regras. Recarregue a página.</p>
        ) : (
          data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recurso / campo</TableHead>
                    <TableHead>Aplicação</TableHead>
                    <TableHead>Proteção</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.field_rules.map((rule) => {
                    const field = canonicalField(rule);
                    const supported = SHARED_FIELD_OPTIONS.some(
                      (option) => option.resource === rule.resource && option.field === field,
                    );
                    const target = rule.role_id
                      ? data.job_roles.find((role) => role.id === rule.role_id)?.name
                      : data.permission_sets.find((set) => set.id === rule.set_id)?.name;
                    return (
                      <TableRow key={rule.id}>
                        <TableCell>
                          {rule.resource}
                          <br />
                          <code>{field}</code>
                        </TableCell>
                        <TableCell>{target ?? "Vínculo indisponível"}</TableCell>
                        <TableCell>
                          {
                            { hidden: "Ocultar", masked: "Mascarar", readonly: "Somente leitura" }[
                              rule.mode
                            ]
                          }
                        </TableCell>
                        <TableCell>
                          {supported
                            ? "Protegido no banco e nas APIs"
                            : "Campo sem contrato: revisar regra antiga"}
                          {rule.is_system ? " · Regra do sistema" : ""}
                        </TableCell>
                        <TableCell>
                          {data.can_manage && !rule.is_system && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelected({ ...rule, field });
                                setOpen(true);
                              }}
                            >
                              Editar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!data.field_rules.length && (
                    <TableRow>
                      <TableCell colSpan={5}>Nenhuma regra de campo cadastrada.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {data.can_manage && (
                <FieldRuleEditorDialog
                  open={open}
                  onOpenChange={setOpen}
                  rule={selected}
                  data={data}
                />
              )}
            </>
          )
        )}
      </CardContent>
    </Card>
  );
}
