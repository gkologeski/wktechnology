/** Columns and their source privacy rules. SQL ACLs remain authoritative. */
export const SHARED_FIELD_COLUMNS = {
  contacts: [
    "email",
    "phone",
    "mobile_phone",
    "hs_raw",
    "phone_digits",
    "mobile_phone_digits",
    "whatsapp_e164",
    "whatsapp_digits",
  ],
  leads: ["score", "hs_raw"],
  deals: ["value", "hs_raw"],
  ats_candidates: ["email", "phone", "cv_parsed"],
  ats_offers: ["salary_amount", "body"],
  ats_interviews: ["notes"],
  deal_line_items: [
    "unit_price",
    "discount_pct",
    "tax_rate",
    "discount_amount",
    "percent",
    "percent_base_amount",
  ],
} as const;
export const SHARED_FIELD_RESOURCES = {
  contacts: "techsales.contacts",
  leads: "techsales.leads",
  deals: "techsales.deals",
  ats_candidates: "techhire.candidates",
  ats_offers: "techhire.offers",
  ats_interviews: "techhire.interviews",
  deal_line_items: "techsales.deals",
} as const;
export const SHARED_FIELD_DEPENDENCIES = {
  contacts: {
    email: ["email"],
    phone: ["phone"],
    mobile_phone: ["mobile_phone"],
    hs_raw: null,
    phone_digits: ["phone"],
    mobile_phone_digits: ["mobile_phone"],
    whatsapp_e164: ["phone", "mobile_phone"],
    whatsapp_digits: ["phone", "mobile_phone"],
  },
  leads: {
    score: ["score"],
    hs_raw: ["score"],
  },
  deals: {
    value: ["value"],
    hs_raw: ["value"],
  },
  ats_candidates: {
    email: ["email"],
    phone: ["phone"],
    cv_parsed: ["email", "phone"],
  },
  ats_offers: {
    salary_amount: ["salary_amount"],
    body: ["salary_amount"],
  },
  ats_interviews: {
    notes: ["notes"],
  },
  deal_line_items: {
    unit_price: ["value"],
    discount_pct: ["value"],
    tax_rate: ["value"],
    discount_amount: ["value"],
    percent: ["value"],
    percent_base_amount: ["value"],
  },
} as const;
export const SHARED_FIELD_OPTIONS = [
  {
    resource: "techsales.contacts",
    field: "email",
  },
  {
    resource: "techsales.contacts",
    field: "phone",
  },
  {
    resource: "techsales.contacts",
    field: "mobile_phone",
  },
  {
    resource: "techsales.leads",
    field: "score",
  },
  {
    resource: "techsales.deals",
    field: "value",
  },
  {
    resource: "techhire.candidates",
    field: "email",
  },
  {
    resource: "techhire.candidates",
    field: "phone",
  },
  {
    resource: "techhire.offers",
    field: "salary_amount",
  },
  {
    resource: "techhire.interviews",
    field: "notes",
  },
] as const;
