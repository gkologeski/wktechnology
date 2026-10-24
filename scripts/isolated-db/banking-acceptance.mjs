// Actual GoTrue/JWT/PostgREST checks, only for the synthetic catalog-derived local stack.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.env.BANKING_ISOLATED_ROOT;
if (!root) throw Error("BANKING_ISOLATED_ROOT is required; no default production endpoint");
const s = JSON.parse(readFileSync(root + "/status.private.json")),
  accounts = JSON.parse(readFileSync(root + "/hr-accounts.private.json"));
if (
  s.API_URL !== "http://127.0.0.1:54521" ||
  readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-permissions-20261023"
)
  throw Error("Isolated only");
const opts = { auth: { persistSession: false, autoRefreshToken: false } },
  admin = createClient(s.API_URL, s.SERVICE_ROLE_KEY, opts),
  clients = [];
const must = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const deny = (r) => {
  if (!r.error) throw Error("Unauthorized operation succeeded");
};
const marker = must(await admin.from("__isolated_marker").select("label"));
if (!marker.some((r) => r.label === "techerp-isolated-harness")) throw Error("Marker missing");
for (const u of accounts) {
  const c = createClient(s.API_URL, s.ANON_KEY, opts);
  must(await c.auth.signInWithPassword({ email: u.email, password: u.password }));
  clients.push(c);
}
const h = clients[0],
  W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b",
  R = "30000000-0000-4000-8000-0000000000a8",
  owner = "10000000-0000-4000-8000-000000000001";
const results = [],
  connections = [],
  entries = [],
  today = new Date().toISOString().slice(0, 10);
const old = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R)
    .like("permission_key", "techfinance.%"),
);
const grant = async (keys, effect = "grant") =>
  must(
    await admin.from("job_role_permission_overrides").upsert(
      keys.map((permission_key) => ({
        workspace_id: W,
        role_id: R,
        permission_key,
        effect,
        created_by: owner,
      })),
      { onConflict: "workspace_id,role_id,permission_key" },
    ),
  );
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
};
const connection = async (workspace) => {
  const c = must(
    await admin
      .from("bank_connections")
      .insert({
        workspace_id: workspace,
        provider: "inter",
        mode: "mock",
        status: "connected",
        created_by: workspace === W ? accounts[0].id : accounts[3].id,
      })
      .select("id")
      .single(),
  );
  connections.push(c.id);
  return c.id;
};
const entry = async (direction = "payable", workspace = W) => {
  const e = must(
    await admin
      .from("financial_entries")
      .insert({
        workspace_id: workspace,
        owner_id: workspace === W ? accounts[0].id : accounts[3].id,
        direction,
        origin_type: "manual",
        description: "[ISO BANKING 212]",
        amount: 100,
        competence_date: today,
        due_date: today,
      })
      .select("id")
      .single(),
  );
  entries.push(e.id);
  return e.id;
};
const draft = async (extra = {}) =>
  h.rpc("banking_create_payment", {
    _data: {
      connection_id: conn,
      type: "pix",
      amount: 60,
      pix_key_type: "random",
      pix_key: "local-only",
      ...extra,
    },
  });
const transition = (id, action) =>
  h.rpc("banking_payment_transition", { _id: id, _action: action });
const event = (id, status = "paid", external = null) =>
  admin.rpc("banking_apply_event", {
    _kind: "payment",
    _id: id,
    _status: status,
    _external: external,
  });
let conn, foreign, payment, linked;
try {
  conn = await connection(W);
  foreign = await connection(B);
  await grant([
    "techfinance.banking.view.workspace",
    "techfinance.bank_payment_drafts.create.workspace",
    "techfinance.entries.view.own",
    "techfinance.payments.view.own",
  ]);
  await check(
    "Nonadmin with banking.view reads selected tenant, other-tenant admin/inactive/no-key cannot read it",
    async () => {
      const rows = must(await h.from("bank_connections").select("id"));
      if (rows.length !== 1 || rows[0].id !== conn) throw Error("Wrong tenant read");
      for (const c of clients.slice(1)) {
        const x = await c.from("bank_connections").select("id").eq("id", conn);
        if (!x.error && x.data.length) throw Error("Other identity read");
      }
    },
  );
  await check("Token/raw OAuth state unavailable even to a browser admin", async () => {
    for (const c of [h, clients[3]]) {
      deny(await c.from("bank_connection_tokens").select("*"));
      deny(await c.from("bank_connections").select("metadata"));
      deny(await c.from("bank_statement_transactions").select("raw"));
    }
  });
  await check("Draft permission does not authorize approval or direct bank DML", async () => {
    payment = must(await draft());
    deny(await transition(payment, "approve"));
    deny(await h.from("bank_payments").update({ status: "paid" }).eq("id", payment));
    deny(
      await h
        .from("bank_payments")
        .insert({ workspace_id: W, connection_id: conn, type: "pix", amount: 1, status: "paid" }),
    );
  });
  await check("Draft cannot bind foreign or wrong-direction entries, TED or NaN", async () => {
    const e = await entry("payable", B),
      bad = await entry("receivable");
    for (const extra of [
      { connection_id: foreign },
      { financial_entry_id: e },
      { financial_entry_id: bad },
      { type: "ted" },
      { amount: "NaN" },
    ])
      deny(await draft(extra));
  });
  await grant(["techfinance.bank_payment_approval.manage.workspace"]);
  await check("Approval does not execute, and concurrent approvals have one winner", async () => {
    const rs = await Promise.all([transition(payment, "approve"), transition(payment, "approve")]);
    if (rs.filter((r) => !r.error).length !== 1) throw Error("Approval raced");
    const p = must(
      await h.from("bank_payments").select("status,external_id").eq("id", payment).single(),
    );
    if (p.status !== "approved" || p.external_id !== null) throw Error("Approval executed");
    deny(await transition(payment, "execute"));
  });
  await grant(["techfinance.bank_payment_execution.manage.workspace"]);
  await check(
    "Execution claim has one winner and cannot be replayed or canceled after sending",
    async () => {
      const rs = await Promise.all([
        transition(payment, "execute"),
        transition(payment, "execute"),
      ]);
      if (rs.filter((r) => !r.error).length !== 1) throw Error("Double claim");
      await grant(["techfinance.bank_payment_cancellation.manage.workspace"]);
      deny(await transition(payment, "cancel_payment"));
    },
  );
  await check(
    "Cancellation is independent; never-sent draft and approval can be canceled",
    async () => {
      const id = must(await draft());
      must(await transition(id, "cancel_payment"));
      deny(await transition(id, "approve"));
      const id2 = must(await draft());
      must(await transition(id2, "approve"));
      must(await transition(id2, "cancel_payment"));
    },
  );
  await check("Future-dated payment is not executed early", async () => {
    const id = must(await draft({ scheduled_for: "2099-01-01" }));
    must(await transition(id, "approve"));
    deny(await transition(id, "execute"));
  });
  await check("Deny revokes execution on an already-issued JWT", async () => {
    const id = must(await draft());
    must(await transition(id, "approve"));
    await grant(["techfinance.bank_payment_execution.manage.workspace"], "deny");
    deny(await transition(id, "execute"));
    await grant(["techfinance.bank_payment_execution.manage.workspace"]);
  });
  await check("Inactive membership revokes action immediately", async () => {
    must(
      await admin
        .from("workspace_members")
        .update({ status: "inactive" })
        .eq("workspace_id", W)
        .eq("user_id", accounts[0].id),
    );
    try {
      deny(await draft());
      deny(await h.rpc("banking_authorize", { _action: "view" }));
    } finally {
      must(
        await admin
          .from("workspace_members")
          .update({ status: "active" })
          .eq("workspace_id", W)
          .eq("user_id", accounts[0].id),
      );
    }
  });
  await check(
    "Atomic settlement: two callbacks produce one ledger payment and one recalculation",
    async () => {
      linked = await entry();
      const id = must(await draft({ financial_entry_id: linked }));
      must(await transition(id, "approve"));
      must(await transition(id, "execute"));
      must(
        await admin.from("bank_payments").update({ external_id: "iso-bank-callback" }).eq("id", id),
      );
      deny(await event(id, "paid", "wrong-provider-id"));
      const rs = await Promise.all([
        event(id, "paid", "iso-bank-callback"),
        event(id, "paid", "iso-bank-callback"),
      ]);
      rs.forEach(must);
      if (rs.filter((x) => x.data.already).length !== 1) throw Error("No idempotent replay");
      const pays = must(await admin.from("financial_payments").select("id").eq("entry_id", linked));
      const e = must(
        await admin.from("financial_entries").select("paid_amount").eq("id", linked).single(),
      );
      if (pays.length !== 1 || Number(e.paid_amount) !== 60)
        throw Error("Duplicate or wrong ledger");
      deny(await event(id, "processing", "iso-bank-callback"));
      deny(await event(id, "failed", "iso-bank-callback"));
    },
  );
  await check(
    "Two different settlements cannot overpay one ledger entry; failed transaction stays processing",
    async () => {
      const e = await entry();
      const ids = [
        must(await draft({ financial_entry_id: e })),
        must(await draft({ financial_entry_id: e })),
      ];
      for (const id of ids) {
        must(await transition(id, "approve"));
        must(await transition(id, "execute"));
      }
      const rs = await Promise.all(ids.map((id) => event(id)));
      if (rs.filter((r) => !r.error).length !== 1) throw Error("Overpaid");
      const p = must(await admin.from("bank_payments").select("status").in("id", ids));
      if (
        p.filter((x) => x.status === "paid").length !== 1 ||
        p.filter((x) => x.status === "processing").length !== 1
      )
        throw Error("Partial state");
    },
  );
  await check(
    "Unauthenticated and normal members cannot invoke service callbacks/token writer",
    async () => {
      const anon = createClient(s.API_URL, s.ANON_KEY, opts);
      for (const c of [h, anon]) {
        deny(
          await c.rpc("banking_apply_event", { _kind: "payment", _id: payment, _status: "paid" }),
        );
        deny(
          await c.rpc("banking_store_tokens", {
            _connection: conn,
            _workspace: W,
            _tokens: { access_token: "plaintext" },
          }),
        );
      }
      deny(await anon.rpc("banking_authorize", { _action: "view" }));
    },
  );
  await check(
    "OAuth state is bound to actor, expires, is single-use; tokens cannot be plaintext",
    async () => {
      must(
        await admin
          .from("bank_connections")
          .update({
            status: "connecting",
            metadata: {
              pending_state: "iso-state",
              pending_actor: accounts[0].id,
              pending_at: new Date().toISOString(),
            },
          })
          .eq("id", conn),
      );
      await grant(["techfinance.banking.manage.workspace"]);
      const args = {
        _connection: conn,
        _workspace: W,
        _actor: accounts[0].id,
        _state: "iso-state",
        _tokens: {
          access_token: "plaintext",
          refresh_token: null,
          token_type: "Bearer",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
      };
      deny(await admin.rpc("banking_store_tokens", args));
      must(
        await admin
          .from("bank_connections")
          .update({
            metadata: {
              pending_state: "iso-state",
              pending_actor: accounts[0].id,
              pending_at: "2000-01-01T00:00:00.000Z",
            },
          })
          .eq("id", conn),
      );
      deny(
        await admin.rpc("banking_store_tokens", {
          ...args,
          _tokens: { ...args._tokens, access_token: "enc:v1:synthetic" },
        }),
      );
      must(
        await admin
          .from("bank_connections")
          .update({
            metadata: {
              pending_state: "iso-state",
              pending_actor: accounts[0].id,
              pending_at: new Date().toISOString(),
            },
          })
          .eq("id", conn),
      );
      deny(await admin.rpc("banking_store_tokens", { ...args, _actor: accounts[1].id }));
      must(
        await admin.rpc("banking_store_tokens", {
          ...args,
          _tokens: { ...args._tokens, access_token: "enc:v1:synthetic-not-real-ciphertext" },
        }),
      );
      deny(
        await admin.rpc("banking_store_tokens", {
          ...args,
          _tokens: { ...args._tokens, access_token: "enc:v1:synthetic" },
        }),
      );
    },
  );
  await grant(["techfinance.banking.update.workspace"]);
  await check(
    "Reconciliation rejects foreign/invisible/wrong-direction ledger payments and cannot rewrite bank amount",
    async () => {
      const e = await entry("receivable"),
        p = must(
          await admin
            .from("financial_payments")
            .insert({ workspace_id: W, entry_id: e, amount: 10, paid_at: today })
            .select("id")
            .single(),
        );
      const tx = must(
        await admin
          .from("bank_statement_transactions")
          .insert({
            workspace_id: W,
            connection_id: conn,
            external_id: "iso-match",
            posted_at: new Date().toISOString(),
            amount: 10,
            direction: "debit",
          })
          .select("id")
          .single(),
      );
      deny(
        await h
          .from("bank_statement_transactions")
          .update({ reconciliation_status: "matched", matched_payment_id: p.id })
          .eq("id", tx.id),
      );
      deny(await h.from("bank_statement_transactions").update({ amount: 1 }).eq("id", tx.id));
      must(
        await h
          .from("bank_statement_transactions")
          .update({ reconciliation_status: "ignored", matched_payment_id: null })
          .eq("id", tx.id),
      );
    },
  );
  await check("Two statement matches cannot consume one ledger payment concurrently", async () => {
    const e = await entry("payable"),
      p = must(
        await admin
          .from("financial_payments")
          .insert({ workspace_id: W, entry_id: e, amount: 10, paid_at: today })
          .select("id")
          .single(),
      );
    const txs = must(
      await admin
        .from("bank_statement_transactions")
        .insert(
          [1, 2].map((i) => ({
            workspace_id: W,
            connection_id: conn,
            external_id: "iso-concurrent-match-" + i,
            posted_at: new Date().toISOString(),
            amount: 10,
            direction: "debit",
          })),
        )
        .select("id"),
    );
    const rs = await Promise.all(
      txs.map((t) =>
        h
          .from("bank_statement_transactions")
          .update({ reconciliation_status: "matched", matched_payment_id: p.id })
          .eq("id", t.id)
          .select("id"),
      ),
    );
    if (rs.filter((r) => !r.error && r.data.length).length !== 1)
      throw Error("Same payment matched twice");
  });
  await check(
    "AR callback is atomic and concurrent redelivery has one ledger receipt",
    async () => {
      const e = await entry("receivable");
      const c = must(
        await admin
          .from("bank_charges")
          .insert({
            workspace_id: W,
            connection_id: conn,
            financial_entry_id: e,
            type: "pix",
            amount: 40,
            due_date: today,
            external_id: "iso-charge",
          })
          .select("id")
          .single(),
      );
      const rs = await Promise.all(
        [1, 2].map(() =>
          admin.rpc("banking_apply_event", {
            _kind: "charge",
            _id: c.id,
            _status: "paid",
            _external: "iso-charge",
          }),
        ),
      );
      rs.forEach(must);
      if (rs.filter((r) => r.data.already).length !== 1) throw Error("AR duplicate");
      const pays = must(await admin.from("financial_payments").select("id").eq("entry_id", e));
      const row = must(
        await admin.from("financial_entries").select("paid_amount").eq("id", e).single(),
      );
      if (pays.length !== 1 || Number(row.paid_amount) !== 40) throw Error("AR ledger mismatch");
      deny(
        await admin.rpc("banking_apply_event", {
          _kind: "charge",
          _id: c.id,
          _status: "canceled",
          _external: "iso-charge",
        }),
      );
    },
  );
  await check(
    "Concurrent credential refresh keeps one active token and rejects stale rotation",
    async () => {
      const old = must(
        await admin
          .from("bank_connection_tokens")
          .select("id")
          .eq("connection_id", conn)
          .is("rotated_at", null)
          .single(),
      );
      const args = {
        _connection: conn,
        _workspace: W,
        _expected: old.id,
        _tokens: {
          access_token: "enc:v1:synthetic-refresh",
          refresh_token: null,
          token_type: "Bearer",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
      };
      const claims = await Promise.all([
        admin.rpc("banking_claim_refresh", { _connection: conn, _expected: old.id }),
        admin.rpc("banking_claim_refresh", { _connection: conn, _expected: old.id }),
      ]);
      claims.forEach(must);
      if (claims.filter((x) => x.data === true).length !== 1)
        throw Error("Duplicate external refresh lease");
      const rs = await Promise.all([
        admin.rpc("banking_store_tokens", args),
        admin.rpc("banking_store_tokens", args),
      ]);
      rs.forEach(must);
      if (rs.filter((x) => x.data === true).length !== 1) throw Error("Token refresh duplicated");
      const rows = must(
        await admin
          .from("bank_connection_tokens")
          .select("id")
          .eq("connection_id", conn)
          .is("rotated_at", null),
      );
      if (rows.length !== 1) throw Error("Active tokens duplicated");
    },
  );
  await check("Read-only role session may consult but cannot claim banking effects", async () => {
    const auth = must(await h.auth.getSession());
    const claims = JSON.parse(
      Buffer.from(auth.session.access_token.split(".")[1], "base64url").toString(),
    );
    const v = must(
      await admin
        .from("view_as_sessions")
        .insert({
          workspace_id: W,
          admin_id: owner,
          target_user_id: accounts[0].id,
          mode: "role",
          role_id: R,
          read_only: true,
          nonce: "isolated-banking-" + Date.now(),
          session_id: claims.session_id,
          expires_at: new Date(Date.now() + 60000).toISOString(),
        })
        .select("id")
        .single(),
    );
    try {
      if (must(await h.rpc("is_read_only_view")) !== true)
        throw Error("Read-only session not active");
      must(await h.rpc("banking_authorize", { _action: "view" }));
      deny(await draft());
      deny(await h.rpc("banking_authorize", { _action: "connect" }));
      deny(await h.rpc("banking_authorize", { _action: "execute" }));
    } finally {
      must(await admin.from("view_as_sessions").delete().eq("id", v.id));
    }
  });
  await check(
    "Caller creates and reconciles a statement atomically with the additional ledger permissions",
    async () => {
      await grant(["techfinance.entries.create.own", "techfinance.payments.create.own"]);
      const tx = must(
        await admin
          .from("bank_statement_transactions")
          .insert({
            workspace_id: W,
            connection_id: conn,
            external_id: "iso-create-ledger",
            posted_at: new Date().toISOString(),
            amount: 12,
            direction: "debit",
            description: "[ISO BANKING 212]",
          })
          .select("id")
          .single(),
      );
      const result = must(await h.rpc("finance_reconcile_transaction", { _transaction: tx.id }));
      if (!result.created) throw Error("Ledger not created");
      entries.push(result.entry_id);
      const e = must(
        await h
          .from("financial_entries")
          .select("paid_amount,amount")
          .eq("id", result.entry_id)
          .single(),
      );
      if (Number(e.paid_amount) !== 12 || Number(e.amount) !== 12)
        throw Error("Wrong ledger balance");
      if (must(await h.rpc("finance_reconcile_transaction", { _transaction: tx.id })).created)
        throw Error("Reconciliation replay");
    },
  );
} finally {
  for (const c of connections) {
    must(await admin.from("bank_statement_transactions").delete().eq("connection_id", c));
    must(await admin.from("bank_payments").delete().eq("connection_id", c));
    must(await admin.from("bank_charges").delete().eq("connection_id", c));
    must(await admin.from("bank_connection_tokens").delete().eq("connection_id", c));
    must(await admin.from("bank_connection_events").delete().eq("connection_id", c));
    must(await admin.from("bank_connections").delete().eq("id", c));
  }
  if (entries.length) must(await admin.from("financial_entries").delete().in("id", entries));
  must(
    await admin
      .from("job_role_permission_overrides")
      .delete()
      .eq("workspace_id", W)
      .eq("role_id", R)
      .like("permission_key", "techfinance.%"),
  );
  if (old.length) must(await admin.from("job_role_permission_overrides").insert(old));
  const residue = must(
    await admin.from("financial_entries").select("id").eq("description", "[ISO BANKING 212]"),
  );
  writeFileSync(
    root + "/banking212-acceptance.json",
    JSON.stringify(
      {
        real_authentication: true,
        synthetic_nonadmin: true,
        external_provider_calls: 0,
        results,
        cleanup: { entry_residue: residue.length, role_restored: true },
      },
      null,
      2,
    ),
  );
  for (const c of clients) await c.auth.signOut();
}
if (results.some((r) => !r.passed)) process.exitCode = 1;
