import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Key, Copy, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";

export function ApiTokensManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [tokenName, setTokenName] = useState("");
  const [expiresIn, setExpiresIn] = useState("never");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: tokens = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/api-tokens"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; expiresAt: string | null }) => {
      const res = await apiRequest("POST", "/api/api-tokens", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setNewToken(data.plainToken);
      setTokenName("");
      setExpiresIn("never");
      queryClient.invalidateQueries({ queryKey: ["/api/api-tokens"] });
      toast({ title: t("settings.apiTokenCreated") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/api-tokens/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-tokens"] });
      toast({ title: t("settings.apiTokenRevoked") });
    },
  });

  function handleCreate() {
    if (!tokenName.trim()) return;
    let expiresAt: string | null = null;
    if (expiresIn === "30d") expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    else if (expiresIn === "90d") expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    else if (expiresIn === "1y") expiresAt = new Date(Date.now() + 365 * 86400000).toISOString();
    createMutation.mutate({ name: tokenName.trim(), expiresAt });
  }

  function handleCopy() {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Key className="w-4 h-4" />
          {t("settings.apiTokensTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.apiTokensDescription")}
        </p>
      </div>

      {newToken && (
        <Card className="p-4 mb-4 border-green-500/50 bg-green-500/5">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">{t("settings.apiTokenCopyWarning")}</p>
              <code className="text-xs bg-muted px-2 py-1 rounded break-all block" data-testid="text-new-token">{newToken}</code>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-token">
              {copied ? <Eye className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewToken(null)} data-testid="button-dismiss-token">
            {t("settings.apiTokenDismiss")}
          </Button>
        </Card>
      )}

      <Card className="p-4 mb-4">
        <h3 className="text-sm font-medium mb-3">{t("settings.apiTokenCreate")}</h3>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="token-name" className="text-xs">{t("settings.apiTokenName")}</Label>
            <Input
              id="token-name"
              placeholder={t("settings.apiTokenNamePlaceholder")}
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              data-testid="input-token-name"
            />
          </div>
          <div className="w-[160px]">
            <Label className="text-xs">{t("settings.apiTokenExpiry")}</Label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger data-testid="select-token-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">{t("settings.apiTokenExpiryNever")}</SelectItem>
                <SelectItem value="30d">{t("settings.apiTokenExpiry30d")}</SelectItem>
                <SelectItem value="90d">{t("settings.apiTokenExpiry90d")}</SelectItem>
                <SelectItem value="1y">{t("settings.apiTokenExpiry1y")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={!tokenName.trim() || createMutation.isPending} data-testid="button-create-token">
            <Plus className="w-4 h-4 mr-1" />
            {t("settings.apiTokenGenerate")}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : tokens.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground" data-testid="text-no-tokens">
          {t("settings.apiTokenEmpty")}
        </Card>
      ) : (
        <div className="space-y-2">
          {tokens.map((token: any) => (
            <Card key={token.id} className={`p-3 flex items-center justify-between gap-3 ${token.revokedAt ? "opacity-50" : ""}`} data-testid={`card-token-${token.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" data-testid={`text-token-name-${token.id}`}>{token.name}</span>
                  <code className="text-xs text-muted-foreground">{token.tokenPrefix}...</code>
                  {token.revokedAt && <Badge variant="destructive" className="text-xs">{t("settings.apiTokenStatusRevoked")}</Badge>}
                  {!token.revokedAt && token.expiresAt && new Date(token.expiresAt) < new Date() && (
                    <Badge variant="secondary" className="text-xs">{t("settings.apiTokenStatusExpired")}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("settings.apiTokenCreatedAt")}: {new Date(token.createdAt).toLocaleDateString()}
                  {token.lastUsedAt && <> &middot; {t("settings.apiTokenLastUsed")}: {new Date(token.lastUsedAt).toLocaleDateString()}</>}
                  {token.expiresAt && <> &middot; {t("settings.apiTokenExpiresAt")}: {new Date(token.expiresAt).toLocaleDateString()}</>}
                </div>
              </div>
              {!token.revokedAt && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive" data-testid={`button-revoke-token-${token.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("settings.apiTokenRevokeTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("settings.apiTokenRevokeDescription")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => revokeMutation.mutate(token.id)} data-testid={`button-confirm-revoke-${token.id}`}>
                        {t("settings.apiTokenRevokeConfirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
