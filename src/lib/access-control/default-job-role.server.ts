const DEFAULT_ROLE_NAME = {
  owner: "Workspace Owner",
  admin: "Workspace Admin",
  manager: "Gerente Comercial",
  member: "Vendedor",
} as const;

type WorkspaceRole = keyof typeof DEFAULT_ROLE_NAME;

type JobRoleClient = {
  from: (table: "job_roles") => {
    select: (columns: "id") => {
      eq: (
        column: "is_system",
        value: true,
      ) => {
        eq: (
          column: "name",
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

export async function resolveDefaultJobRoleId(
  client: JobRoleClient,
  role: string,
): Promise<string> {
  const roleName =
    DEFAULT_ROLE_NAME[(role in DEFAULT_ROLE_NAME ? role : "member") as WorkspaceRole];
  const { data, error } = await client
    .from("job_roles")
    .select("id")
    .eq("is_system", true)
    .eq("name", roleName)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível localizar o cargo padrão: ${error.message}`);
  if (!data?.id) throw new Error(`Cargo padrão não configurado: ${roleName}.`);
  return data.id;
}
