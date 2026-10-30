import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Ícones do app: Google Material Symbols Rounded (outline, traço fino).
 * Mantém a mesma API dos ícones antigos (className com size-4 / h-4 w-4,
 * prop `size`, classes `fill-*` para versão preenchida), então os
 * componentes só trocam o import.
 */
export type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  size?: number | string;
  color?: string;
  fill?: string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
};

const SPACING_REM = 0.25;

// Só os ícones usados são baixados (parâmetro icon_names do Google Fonts).
const NOMES_USADOS = new Set<string>();

export function materialSymbolsHref() {
  const nomes = [...NOMES_USADOS].sort().join(",");
  return `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20,300,0..1,0&icon_names=${nomes}&display=block`;
}

// Lê o tamanho a partir das classes de dimensão (size-4, h-3.5, size-[18px]).
function tamanhoDaClasse(className?: string): string | undefined {
  if (!className) return undefined;
  for (const token of className.split(/\s+/)) {
    const m = /^(?:size|h|w)-(?:(\d+(?:\.\d+)?)|\[(\d+(?:\.\d+)?)(px|rem)\])$/.exec(token);
    if (!m) continue;
    if (m[1]) return `${Number(m[1]) * SPACING_REM}rem`;
    return `${m[2]}${m[3]}`;
  }
  return undefined;
}

function criarIcone(nome: string, displayName: string) {
  NOMES_USADOS.add(nome);
  const Icone = forwardRef<HTMLSpanElement, IconProps>(function Icone(
    { size, color, fill, strokeWidth: _sw, absoluteStrokeWidth: _asw, className, style, ...rest },
    ref,
  ) {
    const fontSize =
      size !== undefined
        ? typeof size === "number"
          ? `${size}px`
          : size
        : (tamanhoDaClasse(className) ?? "24px");
    const preenchido =
      (fill !== undefined && fill !== "none") || /(^|\s)fill-(?!none\b)/.test(className ?? "");
    const estilo: CSSProperties = {
      fontSize,
      width: fontSize,
      height: fontSize,
      color,
      fontVariationSettings: `'FILL' ${preenchido ? 1 : 0}, 'wght' 300, 'GRAD' 0, 'opsz' 20`,
      ...style,
    };
    return (
      <span
        ref={ref}
        aria-hidden="true"
        translate="no"
        className={cn("material-symbols-rounded", className)}
        style={estilo}
        {...rest}
      >
        {nome}
      </span>
    );
  });
  Icone.displayName = displayName;
  return Icone;
}

export const AlertTriangle = criarIcone("warning", "AlertTriangle");
export const ArrowLeft = criarIcone("arrow_back", "ArrowLeft");
export const ArrowRight = criarIcone("arrow_forward", "ArrowRight");
export const ArrowUpDown = criarIcone("swap_vert", "ArrowUpDown");
export const AtSign = criarIcone("alternate_email", "AtSign");
export const Bell = criarIcone("notifications", "Bell");
export const BellRing = criarIcone("notifications_active", "BellRing");
export const Bold = criarIcone("format_bold", "Bold");
export const Calendar = criarIcone("calendar_today", "Calendar");
export const CalendarCheck = criarIcone("event_available", "CalendarCheck");
export const CalendarDays = criarIcone("calendar_month", "CalendarDays");
export const CalendarOff = criarIcone("event_busy", "CalendarOff");
export const CalendarRange = criarIcone("date_range", "CalendarRange");
export const Check = criarIcone("check", "Check");
export const CheckCircle2 = criarIcone("check_circle", "CheckCircle2");
export const CheckSquare = criarIcone("check_box", "CheckSquare");
export const ChevronDown = criarIcone("expand_more", "ChevronDown");
export const ChevronLeft = criarIcone("chevron_left", "ChevronLeft");
export const ChevronRight = criarIcone("chevron_right", "ChevronRight");
export const ChevronUp = criarIcone("expand_less", "ChevronUp");
export const Circle = criarIcone("circle", "Circle");
export const Clock = criarIcone("schedule", "Clock");
export const Columns3 = criarIcone("view_week", "Columns3");
export const Download = criarIcone("download", "Download");
export const Eye = criarIcone("visibility", "Eye");
export const EyeOff = criarIcone("visibility_off", "EyeOff");
export const Filter = criarIcone("filter_alt", "Filter");
export const Flag = criarIcone("flag", "Flag");
export const Folder = criarIcone("folder", "Folder");
export const Gauge = criarIcone("speed", "Gauge");
export const GripVertical = criarIcone("drag_indicator", "GripVertical");
export const HelpCircle = criarIcone("help", "HelpCircle");
export const Image = criarIcone("image", "Image");
export const ImagePlus = criarIcone("add_photo_alternate", "ImagePlus");
export const Inbox = criarIcone("inbox", "Inbox");
export const Info = criarIcone("info", "Info");
export const Italic = criarIcone("format_italic", "Italic");
export const KeyRound = criarIcone("key", "KeyRound");
export const LayoutDashboard = criarIcone("space_dashboard", "LayoutDashboard");
export const LayoutGrid = criarIcone("grid_view", "LayoutGrid");
export const Lightbulb = criarIcone("lightbulb", "Lightbulb");
export const Link = criarIcone("link", "Link");
export const Link2 = criarIcone("link", "Link2");
export const List = criarIcone("list", "List");
export const ListOrdered = criarIcone("format_list_numbered", "ListOrdered");
export const ListTodo = criarIcone("checklist", "ListTodo");
export const LogIn = criarIcone("login", "LogIn");
export const LogOut = criarIcone("logout", "LogOut");
export const MailPlus = criarIcone("forward_to_inbox", "MailPlus");
export const Maximize2 = criarIcone("open_in_full", "Maximize2");
export const Menu = criarIcone("menu", "Menu");
export const MessageSquare = criarIcone("chat_bubble", "MessageSquare");
export const Minimize2 = criarIcone("close_fullscreen", "Minimize2");
export const Minus = criarIcone("remove", "Minus");
export const MoreHorizontal = criarIcone("more_horiz", "MoreHorizontal");
export const NotebookPen = criarIcone("edit_note", "NotebookPen");
export const Package = criarIcone("inventory_2", "Package");
export const Palette = criarIcone("palette", "Palette");
export const PanelLeft = criarIcone("left_panel_open", "PanelLeft");
export const PanelLeftClose = criarIcone("left_panel_close", "PanelLeftClose");
export const PanelLeftOpen = criarIcone("left_panel_open", "PanelLeftOpen");
export const Paperclip = criarIcone("attach_file", "Paperclip");
export const Pencil = criarIcone("edit", "Pencil");
export const Pin = criarIcone("keep", "Pin");
export const PinOff = criarIcone("keep_off", "PinOff");
export const Plus = criarIcone("add", "Plus");
export const RefreshCw = criarIcone("sync", "RefreshCw");
export const RotateCw = criarIcone("refresh", "RotateCw");
export const Repeat = criarIcone("repeat", "Repeat");
export const RotateCcw = criarIcone("restore", "RotateCcw");
export const Save = criarIcone("save", "Save");
export const Search = criarIcone("search", "Search");
export const Send = criarIcone("send", "Send");
export const Settings = criarIcone("settings", "Settings");
export const ShieldCheck = criarIcone("verified_user", "ShieldCheck");
export const Star = criarIcone("star", "Star");
export const ThumbsUp = criarIcone("thumb_up", "ThumbsUp");
export const Timer = criarIcone("timer", "Timer");
export const Trash2 = criarIcone("delete", "Trash2");
export const Underline = criarIcone("format_underlined", "Underline");
export const User = criarIcone("person", "User");
export const UserCheck = criarIcone("how_to_reg", "UserCheck");
export const UserPlus = criarIcone("person_add", "UserPlus");
export const UserX = criarIcone("person_remove", "UserX");
export const Users = criarIcone("group", "Users");
export const X = criarIcone("close", "X");

export const ChevronDownIcon = ChevronDown;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
