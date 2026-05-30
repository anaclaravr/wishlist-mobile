"use client";

import { Check, Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";

import type { AccessProfile } from "@/lib/access-db";
import type { Wishlist } from "@/lib/db";
import { CommonButton, IconButton } from "@/components/ui/button-system";
import { formatAdminDate, summarizePermissions } from "@/components/admin-shared";

export function UsersTable({
  profiles: initialProfiles,
  wishlist,
}: {
  profiles: AccessProfile[];
  wishlist: Wishlist;
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [ownerName, setOwnerName] = useState(wishlist.ownerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(wishlist.ownerEmail ?? "");
  const [ownerAvatarUrl, setOwnerAvatarUrl] = useState(wishlist.ownerAvatarUrl ?? "");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshProfiles() {
    const response = await fetch("/api/admin/profiles");
    const result = (await response.json()) as { profiles?: AccessProfile[]; error?: string };
    if (!response.ok || !result.profiles) {
      throw new Error(result.error ?? "Nao foi possivel carregar os perfis.");
    }
    setProfiles(result.profiles);
  }

  async function copyAccessKey(accessKey: string) {
    try {
      await navigator.clipboard.writeText(accessKey);
      setMessage("Chave copiada.");
      setError(null);
    } catch {
      setError("Nao foi possivel copiar a chave.");
    }
  }

  async function regenerateProfileKey(role: AccessProfile["role"]) {
    setPendingAction(`regen:${role}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, action: "regenerate" }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel regenerar a chave.");
      }
      await refreshProfiles();
      setMessage(`Chave de ${role} regenerada.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleProfile(role: AccessProfile["role"], isActive: boolean) {
    setPendingAction(`toggle:${role}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, action: "toggle", isActive }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel atualizar o perfil.");
      }
      await refreshProfiles();
      setMessage(`Perfil ${role} ${isActive ? "ativado" : "desativado"}.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAvatarUpload(file?: File) {
    if (!file) {
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
      reader.readAsDataURL(file);
    });
    setOwnerAvatarUrl(dataUrl);
  }

  async function saveOwnerProfile() {
    setPendingAction("owner:save");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/wishlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: wishlist.title,
          slug: wishlist.slug,
          ownerName,
          ownerEmail,
          ownerAvatarUrl,
        }),
      });
      const result = (await response.json()) as { wishlist?: Wishlist; error?: string };
      if (!response.ok || !result.wishlist) {
        throw new Error(result.error ?? "Nao foi possivel salvar os dados do user.");
      }
      setOwnerName(result.wishlist.ownerName ?? "");
      setOwnerEmail(result.wishlist.ownerEmail ?? "");
      setOwnerAvatarUrl(result.wishlist.ownerAvatarUrl ?? "");
      setMessage("Dados do user atualizados.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="space-y-3">
      {message ? (
        <p className="rounded-xl border border-[#bddfce] bg-[#e8f8ef] px-3 py-2 text-sm font-medium text-[#276348]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">
          {error}
        </p>
      ) : null}

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">User principal (perfil exibido na sidebar)</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 overflow-hidden rounded-xl border border-[#d1d9e9] bg-[#f0f3f9]">
              {ownerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ownerAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <label className="inline-flex cursor-pointer rounded-lg border border-[#d1d9e9] bg-white px-2 py-1 text-xs text-[#55607a]">
              Upload
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleAvatarUpload(event.target.files?.[0])}
              />
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-[#7a8298]">Nome</span>
              <input
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-[#7a8298]">E-mail</span>
              <input
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-[11px] font-medium text-[#7a8298]">Foto (URL alternativa)</span>
              <input
                value={ownerAvatarUrl}
                onChange={(event) => setOwnerAvatarUrl(event.target.value)}
                placeholder="https://... ou upload acima"
                className="h-10 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
              />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <CommonButton
                type="button"
                onClick={saveOwnerProfile}
                disabled={pendingAction === "owner:save"}
                variant="secondary"
                usage="general"
                showIconLeft
                iconLeft={pendingAction === "owner:save" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              >
                Salvar perfil
              </CommonButton>
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-[#151b28]">Users e permissoes</h3>
          <IconButton
            type="button"
            onClick={() =>
              refreshProfiles().catch((loadError) =>
                setError(loadError instanceof Error ? loadError.message : "Erro inesperado."),
              )
            }
            size="sm"
            variant="secondary"
            title="Atualizar users"
            aria-label="Atualizar users"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.02em] text-[#7a8298]">
                <th className="px-3 py-1">Role</th>
                <th className="px-3 py-1">Permissoes</th>
                <th className="px-3 py-1">Status</th>
                <th className="px-3 py-1">Ultimo uso / regen</th>
                <th className="px-3 py-1">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="rounded-2xl border border-[#dbe1ed] bg-[#fbfcff]">
                  <td className="rounded-l-2xl px-3 py-3 text-sm font-medium capitalize text-[#1a2131]">
                    {profile.role}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {summarizePermissions(profile).map((permissionLabel) => (
                        <span
                          key={`${profile.id}-${permissionLabel}`}
                          className="inline-flex rounded-full border border-[#d9deeb] bg-white px-2 py-0.5 text-xs text-[#5f6882]"
                        >
                          {permissionLabel}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        profile.isActive ? "bg-[#e8f8ef] text-[#2a6b4d]" : "bg-[#fdeef1] text-[#983043]"
                      }`}
                    >
                      {profile.isActive ? (
                        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldX aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      {profile.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-[#5f6882]">
                    <p>{profile.lastUsedAt ? formatAdminDate(profile.lastUsedAt) : "Nunca usado"}</p>
                    <p>Regen: {formatAdminDate(profile.lastRegeneratedAt)}</p>
                  </td>
                  <td className="rounded-r-2xl px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <CommonButton
                        type="button"
                        onClick={() => copyAccessKey(profile.accessKey)}
                        variant="secondary"
                        usage="general"
                        showIconLeft
                        iconLeft={<Copy aria-hidden="true" className="h-4 w-4" />}
                      >
                        Copiar
                      </CommonButton>
                      <CommonButton
                        type="button"
                        onClick={() => regenerateProfileKey(profile.role)}
                        disabled={pendingAction === `regen:${profile.role}`}
                        variant="secondary"
                        usage="general"
                        showIconLeft
                        iconLeft={
                          pendingAction === `regen:${profile.role}` ? (
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound aria-hidden="true" className="h-4 w-4" />
                          )
                        }
                      >
                        Regenerar
                      </CommonButton>
                      {profile.role !== "admin" ? (
                        <CommonButton
                          type="button"
                          onClick={() => toggleProfile(profile.role, !profile.isActive)}
                          disabled={pendingAction === `toggle:${profile.role}`}
                          variant="secondary"
                          usage="general"
                          showIconLeft
                          iconLeft={
                            pendingAction === `toggle:${profile.role}` ? (
                              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check aria-hidden="true" className="h-4 w-4" />
                            )
                          }
                        >
                          {profile.isActive ? "Desativar" : "Ativar"}
                        </CommonButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
