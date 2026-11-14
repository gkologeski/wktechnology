# Contratos

- Imported PDF bodies are read server-side (`pdf-body.server.ts`, unpdf) and every imported body passes `stripControlChars` before insert; why: browser pdf.js failed silently and NUL chars from PDFs make the database reject the whole body.
