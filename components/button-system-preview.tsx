"use client";

import {
  Bold,
  CheckCircle2,
  Edit3,
  Grid2X2,
  Home,
  Info,
  Italic,
  Link2,
  List,
  MoreHorizontal,
  PanelsTopLeft,
  Settings,
  Sparkles,
  Tag,
  TriangleAlert,
  Underline,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import {
  CommonButton,
  IconButton,
  LinkButton,
  MenuCommonButton,
  MenuIconButton,
  SwitchButton,
  Toolbar,
  ToolbarDivider,
  ToolbarItem,
} from "@/components/ui/button-system";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Chip } from "@/components/ui/chip";

export function ButtonSystemPreview() {
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");
  const [selectedChip, setSelectedChip] = useState<"todo" | "progress" | "done">("progress");
  const [showRemovableChip, setShowRemovableChip] = useState(true);

  return (
    <section className="space-y-4">
      <article className="rounded-[20px] border border-[#d8deea] bg-white p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Buttons</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LinkButton iconLeft={<Link2 aria-hidden="true" className="h-4 w-4" />}>Copy Link</LinkButton>
          <CommonButton
            variant="secondary"
            usage="general"
            showIconLeft
            iconLeft={<Edit3 aria-hidden="true" className="h-4 w-4" />}
          >
            Editar
          </CommonButton>
          <CommonButton variant="primary" usage="general">
            Salvar
          </CommonButton>
          <CommonButton variant="secondary" usage="destructive">
            Excluir
          </CommonButton>
          <MenuCommonButton
            showIconLeft
            iconLeft={<Tag aria-hidden="true" className="h-4 w-4" />}
            items={[
              { id: "draft", label: "Rascunho" },
              { id: "in-progress", label: "Em progresso", separatorBefore: true },
              { id: "done", label: "Concluída" },
            ]}
          >
            Set status
          </MenuCommonButton>
          <IconButton aria-label="Informações" variant="info">
            <Info aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <MenuIconButton
            ariaLabel="Mais ações"
            variant="secondary"
            menuPosition="bottom"
            menuAlignment="right"
            dropdown
            tooltip
            items={[
              { id: "favorite", label: "Adicionar aos favoritos", icon: <Tag aria-hidden="true" className="h-4 w-4" /> },
              {
                id: "copy",
                label: "Copiar link",
                icon: <Link2 aria-hidden="true" className="h-4 w-4" />,
                shortcut: "Cmd+L",
                separatorBefore: true,
              },
              {
                id: "duplicate",
                label: "Duplicar",
                icon: <Edit3 aria-hidden="true" className="h-4 w-4" />,
                shortcut: "⌘D",
              },
              {
                id: "delete",
                label: "Mover para lixeira",
                icon: <Info aria-hidden="true" className="h-4 w-4" />,
                shortcut: "Delete",
                danger: true,
                separatorBefore: true,
              },
            ]}
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </MenuIconButton>
        </div>
      </article>

      <article className="rounded-[20px] border border-[#d8deea] bg-white p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Toolbar</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <Toolbar>
            <ToolbarItem>
              <SwitchButton
                items={[
                  {
                    value: "left",
                    label: "",
                    ariaLabel: "Grade",
                    icon: <Grid2X2 aria-hidden="true" className="h-4 w-4" />,
                  },
                  {
                    value: "center",
                    label: "",
                    ariaLabel: "Cartões",
                    icon: <PanelsTopLeft aria-hidden="true" className="h-4 w-4" />,
                  },
                  {
                    value: "right",
                    label: "",
                    ariaLabel: "Lista",
                    icon: <List aria-hidden="true" className="h-4 w-4" />,
                  },
                ]}
                value={textAlign}
                onChange={setTextAlign}
              />
            </ToolbarItem>
            <ToolbarDivider />
            <ToolbarItem>
              <IconButton aria-label="Bold" variant="secondary" size="sm">
                <Bold aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </ToolbarItem>
            <ToolbarItem>
              <IconButton aria-label="Italic" variant="secondary" size="sm">
                <Italic aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </ToolbarItem>
            <ToolbarItem>
              <IconButton aria-label="Underline" variant="secondary" size="sm">
                <Underline aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </ToolbarItem>
          </Toolbar>
        </div>
      </article>

      <article className="rounded-[20px] border border-[#d8deea] bg-white p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Breadcrumb</h3>
        <div className="mt-3 space-y-3">
          <Breadcrumb
            items={[
              { label: "Home", href: "/", icon: <Home aria-hidden="true" /> },
              { label: "Configurações", href: "/admin/general", icon: <Settings aria-hidden="true" /> },
              { label: "Usuários", href: "/admin/users", icon: <Users aria-hidden="true" /> },
              { label: "Detalhes" },
            ]}
          />
          <Breadcrumb
            items={[
              { label: "Workspace", href: "/admin" },
              { label: "Pages", href: "/admin/pages" },
              { label: "Wishlist" },
            ]}
          />
        </div>
      </article>

      <article className="rounded-[20px] border border-[#d8deea] bg-white p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Chips</h3>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip type="warning" label="Pending" showIconLeft iconLeft={<TriangleAlert aria-hidden="true" />} />
            <Chip type="info" label="In progress" showIconLeft iconLeft={<Sparkles aria-hidden="true" />} />
            <Chip type="secondary" label="Submitted" showIconLeft iconLeft={<Tag aria-hidden="true" />} />
            <Chip type="success" label="Success" showIconLeft iconLeft={<CheckCircle2 aria-hidden="true" />} />
            <Chip type="destructive" label="Failed" showIconLeft iconLeft={<XCircle aria-hidden="true" />} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip type="tertiary" surface="neutral" label="Default" showIconLeft iconLeft={<Info aria-hidden="true" />} />
            <Chip type="secondary" surface="neutral" label="Processing" showIconLeft iconLeft={<Sparkles aria-hidden="true" />} />
            <Chip type="success" surface="neutral" label="Success" showIconLeft iconLeft={<CheckCircle2 aria-hidden="true" />} />
            <Chip type="warning" surface="neutral" label="Warning" showIconLeft iconLeft={<TriangleAlert aria-hidden="true" />} />
            <Chip type="destructive" surface="neutral" label="Error" showIconLeft iconLeft={<XCircle aria-hidden="true" />} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip
              behavior="selectable"
              selected={selectedChip === "todo"}
              onClick={() => setSelectedChip("todo")}
              type="tertiary"
              label="To do"
              showIconLeft
              showCounter
              counter={2}
            />
            <Chip
              behavior="selectable"
              selected={selectedChip === "progress"}
              onClick={() => setSelectedChip("progress")}
              type="secondary"
              label="In progress"
              showIconLeft
              showCounter
              counter={8}
              size="sm"
            />
            <Chip
              behavior="selectable"
              selected={selectedChip === "done"}
              onClick={() => setSelectedChip("done")}
              type="success"
              label="Done"
              showIconLeft
              closeButton
              onClose={() => setSelectedChip("todo")}
            />
            {showRemovableChip ? (
              <Chip
                type="info"
                label="Removível"
                showIconLeft
                closeButton
                onClose={() => setShowRemovableChip(false)}
              />
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}
