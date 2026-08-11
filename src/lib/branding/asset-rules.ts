// Regras de validação client-side dos assets de branding (formatos e tamanhos).
export const LOGO_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/avif",
];

export const FAVICON_MIMES = [
  "image/png",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_ILLUSTRATION_BYTES = 5 * 1024 * 1024;
