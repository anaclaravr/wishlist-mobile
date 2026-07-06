"use client";

import {
  Bold,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  CircleAlert,
  CircleDot,
  Edit3,
  FileText,
  Globe,
  Hash,
  Grid2X2,
  Home,
  Info,
  Italic,
  Link2,
  List,
  Mail,
  MoreHorizontal,
  Paperclip,
  PanelsTopLeft,
  PencilLine,
  Phone,
  Plus,
  Settings,
  Sparkles,
  Tag,
  Type,
  TriangleAlert,
  Underline,
  Users,
  XCircle,
} from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react";

import {
  CommonButton,
  IconButton,
  ListBox,
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
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Drawer, DrawerFieldRow, DrawerSection } from "@/components/ui/drawer";
import { RichTextEditor, type RichTextBlock } from "@/components/ui/rich-text-editor";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type DrawerPropertyId =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "status"
  | "date"
  | "person"
  | "files"
  | "checkbox"
  | "url"
  | "email"
  | "phone";

const drawerPropertyDefinitions: Array<{
  id: DrawerPropertyId;
  label: string;
  helper: string;
  icon: ReactNode;
}> = [
  { id: "text", label: "Texto", helper: "Entrada livre para nome ou resumo.", icon: <Type aria-hidden="true" className="h-4 w-4" /> },
  { id: "number", label: "Numero", helper: "Campo numerico com step configurado.", icon: <Hash aria-hidden="true" className="h-4 w-4" /> },
  { id: "select", label: "Selecionar", helper: "Selecao unica com combobox.", icon: <CircleDot aria-hidden="true" className="h-4 w-4" /> },
  { id: "multi-select", label: "Selecao multipla", helper: "Multiplas tags com chips.", icon: <List aria-hidden="true" className="h-4 w-4" /> },
  { id: "status", label: "Status", helper: "Estados rapidos com chips selecionaveis.", icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> },
  { id: "date", label: "Data", helper: "Date picker nativo do campo.", icon: <Calendar aria-hidden="true" className="h-4 w-4" /> },
  { id: "person", label: "Pessoa", helper: "Combobox de pessoas com multisselecao.", icon: <Users aria-hidden="true" className="h-4 w-4" /> },
  { id: "files", label: "Arquivos e midia", helper: "Upload local com lista de anexos.", icon: <Paperclip aria-hidden="true" className="h-4 w-4" /> },
  { id: "checkbox", label: "Caixa de selecao", helper: "Booleano para marcado ou nao.", icon: <CheckSquare aria-hidden="true" className="h-4 w-4" /> },
  { id: "url", label: "URL", helper: "Link com validacao visual de destino.", icon: <Globe aria-hidden="true" className="h-4 w-4" /> },
  { id: "email", label: "E-mail", helper: "Contato com teclado apropriado.", icon: <Mail aria-hidden="true" className="h-4 w-4" /> },
  { id: "phone", label: "Telefone", helper: "Campo telefonico para contato direto.", icon: <Phone aria-hidden="true" className="h-4 w-4" /> },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ButtonSystemPreview() {
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");
  const [selectedChip, setSelectedChip] = useState<"todo" | "progress" | "done">("progress");
  const [showRemovableChip, setShowRemovableChip] = useState(true);
  const [singleValue, setSingleValue] = useState<string | null>("daily-basis");
  const [multiValue, setMultiValue] = useState<string[]>(["work", "daily-basis"]);
  const [customOptions, setCustomOptions] = useState<ComboboxOption[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"modal" | "floating">("modal");
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("Create component button web");
  const [drawerDescription, setDrawerDescription] = useState(
    "On the main page there are several banners displayed. The latest main products are displayed at the top.",
  );
  const [drawerDate, setDrawerDate] = useState("2026-05-30");
  const [drawerVisibleProperties, setDrawerVisibleProperties] = useState<DrawerPropertyId[]>([
    "text",
    "status",
    "date",
    "person",
  ]);
  const [isPropertyMenuOpen, setIsPropertyMenuOpen] = useState(false);
  const [drawerTextValue, setDrawerTextValue] = useState("Landing page hero");
  const [drawerNumberValue, setDrawerNumberValue] = useState("12");
  const [drawerSelectValue, setDrawerSelectValue] = useState<string | null>("daily-basis");
  const [drawerMultiSelectValue, setDrawerMultiSelectValue] = useState<string[]>(["work", "weekly-review"]);
  const [drawerStatusValue, setDrawerStatusValue] = useState<string[]>(["progress"]);
  const [drawerPeopleValue, setDrawerPeopleValue] = useState<string[]>(["amanda", "liz"]);
  const [drawerAttachments, setDrawerAttachments] = useState<Array<{ id: string; name: string; meta: string }>>([
    { id: "attachment-1", name: "Brief do projeto.pdf", meta: "PDF · 937 KB" },
  ]);
  const [drawerCheckedValue, setDrawerCheckedValue] = useState(true);
  const [drawerUrlValue, setDrawerUrlValue] = useState("https://workspace.app/projects/hero");
  const [drawerEmailValue, setDrawerEmailValue] = useState("time@workspace.app");
  const [drawerPhoneValue, setDrawerPhoneValue] = useState("+55 11 99999-8888");
  const [drawerCommentValue, setDrawerCommentValue] = useState(
    "Hi @Liz! I checked the results, there are some comments in figma, can you check it now?",
  );
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [drawerBlocks, setDrawerBlocks] = useState<RichTextBlock[]>([
    { id: "block-1", type: "h2", text: "Description" },
    {
      id: "block-2",
      type: "paragraph",
      text: "On the main page there are several banners displayed. Type / to open formatting options.",
    },
  ]);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const propertyMenuRef = useRef<HTMLDivElement | null>(null);

  const comboboxOptions: ComboboxOption[] = [
    { value: "work", label: "Work", helperText: "Categoria principal" },
    { value: "daily-basis", label: "Daily basis", helperText: "Recorrencia alta" },
    { value: "weekly-review", label: "Weekly review", helperText: "Ritmo semanal" },
    { value: "personal", label: "Personal", helperText: "Escopo pessoal" },
    ...customOptions,
  ];
  const peopleOptions: ComboboxOption[] = [
    { value: "amanda", label: "Amanda Rivera", helperText: "Product design" },
    { value: "liz", label: "Liz", helperText: "Marketing lead" },
    { value: "ji", label: "Ji Chang-wook", helperText: "Reviewer" },
    { value: "michael", label: "Michael Nguyen", helperText: "Engineering" },
  ];
  const statusOptions: ComboboxOption[] = [
    { value: "todo", label: "To do", helperText: "Ainda nao iniciado" },
    { value: "progress", label: "In progress", helperText: "Em andamento" },
    { value: "review", label: "In review", helperText: "Aguardando revisao" },
    { value: "blocked", label: "Blocked", helperText: "Com impedimento" },
    { value: "done", label: "Done", helperText: "Concluido" },
  ];
  const drawerInputClassName =
    "h-10 w-full bg-transparent px-0 text-sm text-[#151b28] outline-none";
  const availablePropertyOptions = drawerPropertyDefinitions.filter(
    (property) => !drawerVisibleProperties.includes(property.id),
  );

  useEffect(() => {
    if (!isPropertyMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!propertyMenuRef.current?.contains(event.target as Node)) {
        setIsPropertyMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPropertyMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPropertyMenuOpen]);

  function appendCustomOption(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (comboboxOptions.some((option) => option.value.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    setCustomOptions((current) => [...current, { value: trimmed, label: trimmed, helperText: "Custom" }]);
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setDrawerAttachments((current) => [
      ...current,
      ...files.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        meta: `${file.type ? file.type.toUpperCase() : "Arquivo"} · ${formatFileSize(file.size)}`,
      })),
    ]);
    event.target.value = "";
  }

  function renderDrawerPropertyField(propertyId: DrawerPropertyId) {
    switch (propertyId) {
      case "text":
        return (
          <input
            type="text"
            value={drawerTextValue}
            onChange={(event) => setDrawerTextValue(event.target.value)}
            placeholder="Digite um texto"
            className={drawerInputClassName}
          />
        );
      case "number":
        return (
          <input
            type="number"
            min={0}
            step={1}
            value={drawerNumberValue}
            onChange={(event) => setDrawerNumberValue(event.target.value)}
            placeholder="0"
            className={drawerInputClassName}
          />
        );
      case "select":
        return (
          <div className="max-w-[320px]">
            <Combobox
              variant="embedded"
              options={comboboxOptions}
              value={drawerSelectValue}
              onChange={setDrawerSelectValue}
              placeholder="Selecione uma opcao"
            />
          </div>
        );
      case "multi-select":
        return (
          <div className="max-w-[360px]">
            <Combobox
              variant="embedded"
              options={comboboxOptions}
              selectionMode="multiple"
              value={drawerMultiSelectValue}
              onChange={setDrawerMultiSelectValue}
              placeholder="Selecione mais de uma opcao"
            />
          </div>
        );
      case "status":
        return (
          <div className="max-w-[360px]">
            <Combobox
              variant="embedded"
              options={statusOptions}
              selectionMode="multiple"
              value={drawerStatusValue}
              onChange={setDrawerStatusValue}
              placeholder="Adicione status"
            />
          </div>
        );
      case "date":
        return (
          <input
            type="date"
            value={drawerDate}
            onChange={(event) => setDrawerDate(event.target.value)}
            className={cx(drawerInputClassName, "max-w-[220px]")}
          />
        );
      case "person":
        return (
          <div className="max-w-[360px]">
            <Combobox
              variant="embedded"
              options={peopleOptions}
              selectionMode="multiple"
              value={drawerPeopleValue}
              onChange={setDrawerPeopleValue}
              placeholder="Adicione pessoas"
            />
          </div>
        );
      case "files":
        return (
          <div className="space-y-3">
            <input ref={attachmentInputRef} type="file" multiple className="hidden" onChange={handleAttachmentChange} />
            <div className="flex flex-wrap items-center gap-2">
              <CommonButton
                type="button"
                variant="secondary"
                usage="general"
                showIconLeft
                iconLeft={<Paperclip aria-hidden="true" className="h-4 w-4" />}
                onClick={() => attachmentInputRef.current?.click()}
              >
                Adicionar arquivo
              </CommonButton>
              <span className="text-xs text-[#7a8398]">{drawerAttachments.length} anexos</span>
            </div>
            <div className="space-y-2">
              {drawerAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-[#e8edf5] bg-[#fbfcfe] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#151b28]">{attachment.name}</p>
                    <p className="mt-1 text-xs text-[#7a8398]">{attachment.meta}</p>
                  </div>
                  <IconButton
                    aria-label={`Remover ${attachment.name}`}
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setDrawerAttachments((current) => current.filter((item) => item.id !== attachment.id))
                    }
                  >
                    <XCircle aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>
        );
      case "checkbox":
        return (
          <label className="inline-flex items-center gap-3 text-sm text-[#151b28]">
            <input
              type="checkbox"
              checked={drawerCheckedValue}
              onChange={(event) => setDrawerCheckedValue(event.target.checked)}
              className="h-4 w-4 rounded border border-[#c8d2e3] text-[#3b6fd8] focus:ring-[#8ba2da]"
            />
            Marcar esta propriedade
          </label>
        );
      case "url":
        return (
          <input
            type="url"
            value={drawerUrlValue}
            onChange={(event) => setDrawerUrlValue(event.target.value)}
            placeholder="https://"
            className={drawerInputClassName}
          />
        );
      case "email":
        return (
          <input
            type="email"
            value={drawerEmailValue}
            onChange={(event) => setDrawerEmailValue(event.target.value)}
            placeholder="nome@empresa.com"
            className={drawerInputClassName}
          />
        );
      case "phone":
        return (
          <input
            type="tel"
            value={drawerPhoneValue}
            onChange={(event) => setDrawerPhoneValue(event.target.value)}
            placeholder="+55 11 99999-9999"
            className={drawerInputClassName}
          />
        );
    }
  }

  function addDrawerProperty(propertyId: string | null) {
    if (!propertyId) {
      setIsPropertyMenuOpen(false);
      return;
    }

    if (!drawerPropertyDefinitions.some((property) => property.id === propertyId)) {
      setIsPropertyMenuOpen(false);
      return;
    }

    setDrawerVisibleProperties((current) =>
      current.includes(propertyId as DrawerPropertyId)
        ? current
        : [...current, propertyId as DrawerPropertyId],
    );
    setIsPropertyMenuOpen(false);
  }

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
              { label: "Workspace" },
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

      <article className="rounded-[20px] border border-[#d8deea] bg-white p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Combobox</h3>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <Combobox
            label="Frequencia"
            contextualHelp="Selecione uma opcao existente ou crie uma nova."
            badge={<Chip label="Beta" size="sm" type="secondary" surface="neutral" />}
            helperText="Modo single-select com valor customizado."
            counter={singleValue ? "1 selecionada" : "Nenhuma"}
            placeholder="Selecione uma opcao ou crie uma"
            options={comboboxOptions}
            value={singleValue}
            onChange={setSingleValue}
            allowCustomValue
            onCreateOption={appendCustomOption}
            topAction={{
              id: "clear-single",
              label: "Limpar selecao",
              icon: <XCircle aria-hidden="true" className="h-4 w-4" />,
              disabled: !singleValue,
              onSelect: () => setSingleValue(null),
            }}
            bottomAction={{
              id: "weekly-template",
              label: "Usar padrao semanal",
              icon: <Sparkles aria-hidden="true" className="h-4 w-4" />,
              onSelect: () => setSingleValue("weekly-review"),
            }}
            trailingElement={
              <span className="rounded-full bg-[#eef2fa] px-2 py-1 text-[11px] font-semibold text-[#5d6780]">
                1x
              </span>
            }
          />

          <Combobox
            label="Tags"
            contextualHelp="Suporta multiplas selecoes, selecao em massa e criacao customizada."
            helperText="Modo multi-select com chips removiveis."
            counter={`${multiValue.length}/8`}
            placeholder="Selecione uma opcao ou crie uma"
            options={comboboxOptions}
            selectionMode="multiple"
            value={multiValue}
            onChange={setMultiValue}
            allowCustomValue
            onCreateOption={appendCustomOption}
            topAction={{
              id: "select-all",
              label: "Selecionar tudo",
              icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" />,
              onSelect: () => setMultiValue(comboboxOptions.map((option) => option.value)),
            }}
            bottomAction={{
              id: "clear-all",
              label: "Limpar tudo",
              icon: <XCircle aria-hidden="true" className="h-4 w-4" />,
              disabled: multiValue.length === 0,
              onSelect: () => setMultiValue([]),
            }}
            trailingElement={
              <span className="rounded-full bg-[#eef2fa] px-2 py-1 text-[11px] font-semibold text-[#5d6780]">
                {multiValue.length}
              </span>
            }
          />
        </div>
      </article>

      <article className="rounded-[20px] border border-[#d8deea] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#151b28]">Drawer</h3>
            <p className="mt-1 text-sm text-[#6c7489]">Painel lateral com cabecalho editavel, scroll proprio e footer de acoes.</p>
          </div>
          <div className="flex items-center gap-2">
            <CommonButton
              variant="secondary"
              usage="general"
              onClick={() => {
                setDrawerMode("floating");
                setIsDrawerOpen(true);
              }}
            >
              Abrir interativa
            </CommonButton>
            <CommonButton
              variant="primary"
              usage="info"
              onClick={() => {
                setDrawerMode("modal");
                setIsDrawerOpen(true);
              }}
            >
              Abrir modal
            </CommonButton>
          </div>
        </div>
      </article>

      <Drawer
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setDrawerExpanded(false);
        }}
        title={drawerTitle}
        onTitleChange={setDrawerTitle}
        description={drawerDescription}
        onDescriptionChange={setDrawerDescription}
        modal={drawerMode === "modal"}
        showOverlay={drawerMode === "modal"}
        expanded={drawerExpanded}
        onToggleExpanded={() => setDrawerExpanded((current) => !current)}
        secondaryAction={{ label: "Fechar", onClick: () => setIsDrawerOpen(false) }}
        primaryAction={{ label: "Salvar alteracoes", onClick: () => setIsDrawerOpen(false) }}
        footer={
          <p className="text-sm text-[#7a8398]">
            {drawerMode === "modal"
              ? "Versao modal: bloqueia interacao e scroll do fundo."
              : "Versao interativa: permite interagir e scrollar o fundo com a drawer aberta."}
          </p>
        }
      >
        <div className="flex min-h-full flex-col gap-6">
          <div className="rounded-[18px] border border-[#f0d8d2] bg-[#fff6f3] px-4 py-3 text-sm text-[#8a4f41]">
            <div className="flex items-center gap-2 font-medium">
              <CircleAlert aria-hidden="true" className="h-4 w-4" />
              Patient has a documented allergy to Penicillin.
            </div>
          </div>

          <DrawerSection title="Propriedades">
            <div className="space-y-3 px-0 py-1">
              <div>
                {drawerVisibleProperties.map((propertyId) => {
                  const property = drawerPropertyDefinitions.find((item) => item.id === propertyId);
                  if (!property) {
                    return null;
                  }

                  return (
                    <DrawerFieldRow
                      key={property.id}
                      label={
                        <div className="flex items-center gap-2">
                          <span className="text-[#7a8398]">{property.icon}</span>
                          <span>{property.label}</span>
                        </div>
                      }
                      divider={false}
                    >
                      {renderDrawerPropertyField(property.id)}
                    </DrawerFieldRow>
                  );
                })}
              </div>

              <div ref={propertyMenuRef} className="relative">
                <CommonButton
                  type="button"
                  variant="tertiary"
                  usage="general"
                  showIconLeft
                  iconLeft={<Plus aria-hidden="true" className="h-4 w-4" />}
                  disabled={availablePropertyOptions.length === 0}
                  onClick={() => {
                    if (availablePropertyOptions.length === 0) {
                      return;
                    }
                    setIsPropertyMenuOpen((current) => !current);
                  }}
                  className="h-9 px-0 text-[#5f6b84]"
                >
                  Add a property
                </CommonButton>

                {isPropertyMenuOpen ? (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[320px] rounded-[14px] border border-[#d6ddeb] bg-white p-2 shadow-[var(--ds-shadow-soft)]">
                    <ListBox
                      ariaLabel="Adicionar propriedade"
                      emptyLabel="Todos os campos disponiveis ja estao na lista."
                      items={availablePropertyOptions.map((property) => ({
                        id: property.id,
                        label: property.label,
                        icon: property.icon,
                        onSelect: () => addDrawerProperty(property.id),
                      }))}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </DrawerSection>

          <div className="border-t border-[#edf1f7] pt-6">
            <DrawerSection title="Comentarios">
            <div className="space-y-3">
              <div className="rounded-[18px] border border-[#e8edf5] bg-[#fbfcfe] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Chip label="Ji Chang-wook" type="tertiary" surface="neutral" />
                    <span className="text-xs text-[#7a8398]">2m ago</span>
                  </div>
                  <IconButton
                    aria-label={isEditingComment ? "Salvar comentario" : "Editar comentario"}
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditingComment((current) => !current)}
                  >
                    {isEditingComment ? (
                      <Check aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <PencilLine aria-hidden="true" className="h-4 w-4" />
                    )}
                  </IconButton>
                </div>
                {isEditingComment ? (
                  <textarea
                    rows={4}
                    value={drawerCommentValue}
                    onChange={(event) => setDrawerCommentValue(event.target.value)}
                    className="mt-3 w-full resize-none rounded-[16px] border border-[#d8dfeb] px-4 py-3 text-sm leading-6 text-[#21293c] outline-none focus:border-[#95a8cb]"
                  />
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#21293c]">{drawerCommentValue}</p>
                )}
              </div>

              <textarea
                rows={4}
                placeholder="Comment here..."
                className="w-full rounded-[16px] border border-[#d8dfeb] px-4 py-3 text-sm leading-6 text-[#151b28] outline-none focus:border-[#95a8cb]"
              />
            </div>
            </DrawerSection>
          </div>

          <div className="border-t border-[#edf1f7] pt-6">
            <DrawerSection title="Descricao">
            <div className="flex min-h-[360px] flex-1 flex-col">
              <RichTextEditor value={drawerBlocks} onChange={setDrawerBlocks} className="flex-1" />
              <div className="mt-3 flex items-center gap-2 text-xs text-[#7a8398]">
                <FileText aria-hidden="true" className="h-4 w-4" />
                Digite <strong>/</strong> em um bloco vazio para abrir o menu de formatacao.
              </div>
            </div>
            </DrawerSection>
          </div>
        </div>
      </Drawer>
    </section>
  );
}
