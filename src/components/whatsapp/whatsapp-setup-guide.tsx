import { ExternalLink, Info, KeyRound, Link2, MessageCircleMore, ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import wabaIdImage from "@/assets/whatsapp-guide/waba-id.jpg";
import systemUserImage from "@/assets/whatsapp-guide/system-user.jpg";
import accessTokenImage from "@/assets/whatsapp-guide/access-token.jpg";
import webhookImage from "@/assets/whatsapp-guide/webhook.jpg";

const BUSINESS_SETTINGS_URL = "https://business.facebook.com/settings/";
const DEVELOPERS_URL = "https://developers.facebook.com/apps/";

type GuideSection = {
  value: string;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  dialogTitle?: string;
  warning?: string;
  permissions?: readonly string[];
};

const guideSections: readonly GuideSection[] = [
  {
    value: "waba",
    title: "1. Localize o ID da conta do WhatsApp",
    description:
      "Em Configurações do negócio, abra Contas › Contas do WhatsApp, selecione a conta e copie o ID da conta do WhatsApp Business.",
    image: wabaIdImage,
    imageAlt:
      "Exemplo ilustrativo das Configurações do negócio da Meta com o ID da conta do WhatsApp destacado",
    dialogTitle: "Onde encontrar o WABA ID",
    warning:
      "Não use o ID do negócio nem o ID do número de telefone. O campo correto é o ID da conta do WhatsApp Business.",
  },
  {
    value: "system-user",
    title: "2 e 3. Prepare o Usuário do Sistema e atribua o aplicativo",
    description:
      "Em Usuários › Usuários do sistema, crie ou selecione um usuário, adicione seu aplicativo como ativo e conceda controle total.",
    image: systemUserImage,
    imageAlt:
      "Exemplo ilustrativo da Meta mostrando um Usuário do Sistema com aplicativo e controle total",
    dialogTitle: "Como atribuir o aplicativo",
  },
  {
    value: "token",
    title: "4. Gere o token de acesso",
    description:
      "Gere um novo token para o aplicativo e marque as duas permissões necessárias. Copie o token quando ele aparecer: a Meta pode exibi-lo apenas uma vez.",
    image: accessTokenImage,
    imageAlt:
      "Exemplo ilustrativo da geração de token da Meta com as permissões obrigatórias destacadas",
    dialogTitle: "Como gerar o token",
    permissions: ["whatsapp_business_management", "whatsapp_business_messaging"],
  },
  {
    value: "connect",
    title: "5. Conecte a conta no TechERP",
    description:
      "No formulário Conectar WhatsApp Business Account, cole o WABA ID e o token copiados. O nome é opcional. Ao conectar, o TechERP valida a conta e busca seus números automaticamente.",
    warning:
      "O token é usado somente pela integração e não volta a ser exibido nesta página depois da conexão.",
  },
  {
    value: "webhook",
    title: "6 e 7. Configure o webhook e assine os eventos",
    description:
      "No painel do aplicativo, abra WhatsApp › Configuração. Informe a URL e o token de verificação exibidos nesta página e assine os eventos indicados.",
    image: webhookImage,
    imageAlt: "Exemplo ilustrativo da configuração do webhook da Meta com URL e eventos destacados",
    dialogTitle: "Como configurar o webhook",
    permissions: [
      "messages",
      "message_template_status_update",
      "phone_number_quality_update",
      "account_update",
    ],
  },
  {
    value: "finish",
    title: "8. Sincronize e escolha o número padrão",
    description:
      "Em Contas conectadas, use Sincronizar números. Depois, na lista Números, ative Definir como padrão no número que será usado para os novos envios.",
  },
];

export function WhatsAppSetupGuide() {
  return (
    <section aria-labelledby="whatsapp-setup-guide-title" className="rounded-lg border bg-card">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <MessageCircleMore className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="whatsapp-setup-guide-title" className="font-semibold">
              Como conectar seu WhatsApp
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Siga as etapas na Meta e depois conclua a conexão no formulário desta página.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={BUSINESS_SETTINGS_URL} target="_blank" rel="noreferrer">
              Configurações do negócio
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={DEVELOPERS_URL} target="_blank" rel="noreferrer">
              Aplicativos da Meta
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>

      <Accordion type="single" collapsible defaultValue="waba" className="px-5">
        {guideSections.map((section) => (
          <AccordionItem key={section.value} value={section.value}>
            <AccordionTrigger className="hover:no-underline">
              <span className="pr-4 text-left">{section.title}</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.15fr)] lg:items-start">
                <div className="space-y-3">
                  <p className="leading-6 text-muted-foreground">{section.description}</p>
                  {section.permissions ? (
                    <div
                      className="flex flex-wrap gap-2"
                      aria-label="Itens que devem ser selecionados"
                    >
                      {section.permissions.map((permission) => (
                        <Badge
                          key={permission}
                          variant="secondary"
                          className="font-mono font-normal"
                        >
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {section.warning ? (
                    <div className="flex gap-2 rounded-md border bg-muted p-3 text-xs text-muted-foreground">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{section.warning}</span>
                    </div>
                  ) : null}
                </div>

                {section.image && section.imageAlt && section.dialogTitle ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="group h-auto w-full overflow-hidden p-0"
                        aria-label={`Ampliar: ${section.dialogTitle}`}
                      >
                        <img
                          src={section.image}
                          alt={section.imageAlt}
                          loading="lazy"
                          width={1408}
                          height={832}
                          className="aspect-[22/13] w-full object-cover transition group-hover:opacity-90"
                        />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl">
                      <DialogHeader>
                        <DialogTitle>{section.dialogTitle}</DialogTitle>
                        <DialogDescription>
                          Imagem ilustrativa. A organização dos menus pode variar conforme o idioma
                          e as atualizações da Meta.
                        </DialogDescription>
                      </DialogHeader>
                      <img
                        src={section.image}
                        alt={section.imageAlt}
                        loading="lazy"
                        width={1408}
                        height={832}
                        className="h-auto w-full rounded-md border"
                      />
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="grid gap-3 border-t bg-muted p-5 text-sm sm:grid-cols-3">
        <div className="flex gap-2">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Guarde o token em local seguro e nunca envie por mensagem.</span>
        </div>
        <div className="flex gap-2">
          <Link2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Depois de conectar, sincronize os números da conta.</span>
        </div>
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Defina um número padrão para habilitar os envios.</span>
        </div>
      </div>
    </section>
  );
}
