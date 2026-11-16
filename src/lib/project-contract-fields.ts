/** Contract / site-contact fields stored on public.projects. */

export type ProjectContractContactInput = {
  contract_po?: string | null;
  contract_expiration?: string | null;
  wickd_contact_employee_id?: string | null;
  superintendent_name?: string | null;
  superintendent_phone?: string | null;
  gate_code?: string | null;
};

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function dateOrNull(v: unknown): string | null {
  const s = trimOrNull(v);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function projectContractContactFromBody(body: Record<string, unknown>): ProjectContractContactInput {
  return {
    contract_po: trimOrNull(body.contract_po),
    contract_expiration: dateOrNull(body.contract_expiration),
    wickd_contact_employee_id: trimOrNull(body.wickd_contact_employee_id),
    superintendent_name: trimOrNull(body.superintendent_name),
    superintendent_phone: trimOrNull(body.superintendent_phone),
    gate_code: trimOrNull(body.gate_code),
  };
}

export function projectContractContactToDb(info: ProjectContractContactInput): Record<string, string | null> {
  return {
    contract_po: info.contract_po ?? null,
    contract_expiration: info.contract_expiration ?? null,
    wickd_contact_employee_id: info.wickd_contact_employee_id ?? null,
    superintendent_name: info.superintendent_name ?? null,
    superintendent_phone: info.superintendent_phone ?? null,
    gate_code: info.gate_code ?? null,
  };
}
