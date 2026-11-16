/** DB payload helpers for public.clients general-info columns. */

export type ClientGeneralInfoInput = {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

export type ClientGeneralInfoRow = {
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function clientGeneralInfoFromBody(body: Record<string, unknown>): ClientGeneralInfoInput {
  return {
    street_address: trimOrNull(body.street_address),
    city: trimOrNull(body.city),
    state: trimOrNull(body.state),
    zip_code: trimOrNull(body.zip_code),
  };
}

export function clientGeneralInfoToDb(info: ClientGeneralInfoInput): Record<string, string | null> {
  return {
    street_address: info.street_address ?? null,
    city: info.city ?? null,
    state: info.state ?? null,
    zip_code: info.zip_code ?? null,
  };
}

export function mapClientGeneralInfoRow(row: Record<string, unknown>): ClientGeneralInfoRow {
  return {
    street_address: row.street_address != null ? String(row.street_address) : null,
    city: row.city != null ? String(row.city) : null,
    state: row.state != null ? String(row.state) : null,
    zip_code: row.zip_code != null ? String(row.zip_code) : null,
  };
}

export function formatClientRecordAddress(c: ClientGeneralInfoRow): string {
  const parts = [
    c.street_address,
    [c.city, c.state].filter(Boolean).join(', '),
    c.zip_code,
  ].filter(Boolean);
  return parts.join(', ') || '—';
}
