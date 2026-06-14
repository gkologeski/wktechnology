import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings/language")({
  component: LanguagePage,
});

function LanguagePage() {
  const { locale, setLocale, t } = useT();
  const langs: { code: Locale; label: string }[] = [
    { code: "pt", label: t("language.pt") },
    { code: "en", label: t("language.en") },
    { code: "es", label: t("language.es") },
  ];
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("settings.language")}</h1>
        <p className="text-sm text-muted-foreground">Escolha o idioma da interface.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
          <CardDescription>
            Atual: <strong>{locale.toUpperCase()}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {langs.map((l) => (
            <Button
              key={l.code}
              variant={locale === l.code ? "default" : "outline"}
              onClick={() => setLocale(l.code)}
            >
              {l.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
