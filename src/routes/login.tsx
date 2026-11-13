import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Вход — Контент-продакшн CRM" },
      { name: "description", content: "Вход для сотрудников контент-продакшна." },
      { property: "og:title", content: "Вход — Контент-продакшн CRM" },
      { property: "og:description", content: "Вход для сотрудников контент-продакшна." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");

  useEffect(() => {
    if (ready && session) navigate({ to: "/tasks" });
  }, [ready, session, navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between border-r bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2 font-semibold">
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary font-mono text-sm text-primary-foreground">
            CP
          </span>
          Контент-продакшн
        </div>
        <div className="space-y-4">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            От заявки менеджера до утверждённого AI-визуала — в одном потоке.
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>· Канбан по статусам с контролем дедлайнов</li>
            <li>· Согласование каждого фото и учёт правок по циклам</li>
            <li>· Тестирование CTR и дизайн-воронки</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Внутренняя система. Доступ выдаёт руководитель.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {tab === "signin" ? "Вход" : "Регистрация"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "signin"
                ? "Войдите рабочим email и паролем."
                : "После регистрации руководитель назначит вам роль."}
            </p>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Вход</TabsTrigger>
              <TabsTrigger value="signup">Регистрация</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(await errorMessage(error));
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="si-pass">Пароль</Label>
        <Input id="si-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />} Войти
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setError("Пароль должен быть не короче 6 символов");
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim(), telegram: telegram.trim() },
      },
    });
    if (error) setError(await errorMessage(error));
    else if (!data.session) setSent(true);
    setLoading(false);
  }

  if (sent)
    return (
      <Alert>
        <MailCheck className="size-4" />
        <AlertDescription>
          Мы отправили письмо на <b>{email}</b>. Подтвердите адрес и войдите — затем руководитель
          назначит вам роль.
        </AlertDescription>
      </Alert>
    );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="su-name">ФИО</Label>
        <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-tg">Telegram</Label>
        <Input id="su-tg" placeholder="@username" value={telegram} onChange={(e) => setTelegram(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pass">Пароль</Label>
        <Input id="su-pass" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />} Зарегистрироваться
      </Button>
    </form>
  );
}