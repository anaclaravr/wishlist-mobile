import { AdminAccessGate } from "@/components/admin-access-gate";
import { ButtonSystemPreview } from "@/components/button-system-preview";
import { AdminLayout } from "@/components/admin-layout";
import { getAdminPageData } from "@/lib/admin-hub-data";

export const dynamic = "force-dynamic";

export default async function AdminGeneralPage() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="admin-general"
      title="General"
      description="Configuracoes gerais da aplicacao e base para futuras paginas administrativas."
    >
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
          <h3 className="text-[15px] font-semibold text-[#151b28]">Governanca</h3>
          <p className="mt-2 text-sm text-[#6c7489]">
            Sessao administrativa ativa para o slug <strong>{data.hub.wishlist.slug}</strong>.
          </p>
          <p className="mt-2 text-sm text-[#6c7489]">
            Use Users para gerir papeis e Pages para configurar cada area da aplicacao.
          </p>
        </article>

        <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
          <h3 className="text-[15px] font-semibold text-[#151b28]">Roadmap de configuracoes gerais</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#6c7489]">
            <li>Preferencias globais de notificacao</li>
            <li>Flags de recursos por ambiente</li>
            <li>Politicas de moderacao e auditoria</li>
          </ul>
        </article>
      </section>

      <div className="mt-4">
        <ButtonSystemPreview />
      </div>
    </AdminLayout>
  );
}
