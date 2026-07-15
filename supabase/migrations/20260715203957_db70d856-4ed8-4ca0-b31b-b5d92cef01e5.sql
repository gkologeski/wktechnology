
UPDATE public.quote_templates SET html = replace(html, 'Vaacute;lida ateacute;', 'Válida até') WHERE name IN ('Prosposta 001','Prosposta 002');
UPDATE public.quote_templates SET html = replace(html, 'Item / Descriaacute;o', 'Item / Descrição') WHERE name IN ('Prosposta 001','Prosposta 002');
UPDATE public.quote_templates SET html = replace(html, 'Preaccedil;o Unit.', 'Preço Unit.') WHERE name IN ('Prosposta 001','Prosposta 002');
UPDATE public.quote_templates SET html = replace(html, 'Observaaccedil;otilde;es', 'Observações') WHERE name IN ('Prosposta 001','Prosposta 002');
UPDATE public.quote_templates SET html = replace(html, 'Termos e Condiaccedil;otilde;es', 'Termos e Condições') WHERE name IN ('Prosposta 001','Prosposta 002');
