/**
 * Icon adapter — presents a lucide-react-compatible API on top of Hugeicons.
 *
 * Usage stays identical to lucide: `<FileText className="w-4 h-4" />`.
 * Only the import source changes (`lucide-react` -> `@/components/icons`).
 * Sizing via Tailwind width/height classes wins over the SVG size attributes.
 */
import { forwardRef } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AlertCircleIcon,
  TextAlignLeft01Icon,
  ArrowLeft01Icon,
  ArrowRight02Icon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  Tick02Icon,
  CheckmarkCircle02Icon,
  ArrowRight01Icon,
  CircleIcon,
  Clock01Icon,
  CommandIcon,
  Copy01Icon,
  ArrowTurnBackwardIcon,
  Database01Icon,
  PencilEdit02Icon,
  LinkSquare01Icon,
  ViewIcon,
  ViewOffSlashIcon,
  File01Icon,
  GithubIcon,
  GlobalIcon,
  HashtagIcon,
  Home01Icon,
  Key01Icon,
  DashboardSquare01Icon,
  Loading03Icon,
  SquareLock02Icon,
  Logout01Icon,
  Mail01Icon,
  Menu01Icon,
  BubbleChatIcon,
  QuillWrite02Icon,
  PlusSignIcon,
  FloppyDiskIcon,
  Search01Icon,
  Navigation03Icon,
  Shield01Icon,
  SparklesIcon,
  StarIcon,
  Tag01Icon,
  Delete02Icon,
  Upload04Icon,
  UserIcon,
  UserAdd01Icon,
  UserGroupIcon,
  MagicWand01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  FlashIcon,
} from "@hugeicons/core-free-icons";

export interface IconProps
  extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  size?: string | number;
  strokeWidth?: number;
}

/** Build a lucide-shaped component from a Hugeicons svg object. */
const make = (icon: IconSvgElement, displayName: string) => {
  const Comp = forwardRef<SVGSVGElement, IconProps>(
    ({ strokeWidth = 1.8, ...props }, ref) => (
      <HugeiconsIcon
        ref={ref}
        icon={icon}
        strokeWidth={strokeWidth}
        color="currentColor"
        {...props}
      />
    ),
  );
  Comp.displayName = displayName;
  return Comp;
};

export const AlertCircle = make(AlertCircleIcon, "AlertCircle");
export const AlignLeft = make(TextAlignLeft01Icon, "AlignLeft");
export const ArrowLeft = make(ArrowLeft01Icon, "ArrowLeft");
export const ArrowRight = make(ArrowRight02Icon, "ArrowRight");
export const ArrowUpRight = make(ArrowUpRight01Icon, "ArrowUpRight");
export const Calendar = make(Calendar03Icon, "Calendar");
export const Check = make(Tick02Icon, "Check");
export const CheckCircle2 = make(CheckmarkCircle02Icon, "CheckCircle2");
export const ChevronRight = make(ArrowRight01Icon, "ChevronRight");
export const Circle = make(CircleIcon, "Circle");
export const Clock = make(Clock01Icon, "Clock");
export const Command = make(CommandIcon, "Command");
export const Copy = make(Copy01Icon, "Copy");
export const CornerDownLeft = make(ArrowTurnBackwardIcon, "CornerDownLeft");
export const Database = make(Database01Icon, "Database");
export const Edit = make(PencilEdit02Icon, "Edit");
export const ExternalLink = make(LinkSquare01Icon, "ExternalLink");
export const Eye = make(ViewIcon, "Eye");
export const EyeOff = make(ViewOffSlashIcon, "EyeOff");
export const FileText = make(File01Icon, "FileText");
export const Github = make(GithubIcon, "Github");
export const Globe = make(GlobalIcon, "Globe");
export const Hash = make(HashtagIcon, "Hash");
export const Home = make(Home01Icon, "Home");
export const KeyRound = make(Key01Icon, "KeyRound");
export const LayoutDashboard = make(DashboardSquare01Icon, "LayoutDashboard");
export const Loader2 = make(Loading03Icon, "Loader2");
export const Lock = make(SquareLock02Icon, "Lock");
export const LogOut = make(Logout01Icon, "LogOut");
export const Mail = make(Mail01Icon, "Mail");
export const Menu = make(Menu01Icon, "Menu");
export const MessageSquare = make(BubbleChatIcon, "MessageSquare");
export const PenTool = make(QuillWrite02Icon, "PenTool");
export const Plus = make(PlusSignIcon, "Plus");
export const Save = make(FloppyDiskIcon, "Save");
export const Search = make(Search01Icon, "Search");
export const Send = make(Navigation03Icon, "Send");
export const Shield = make(Shield01Icon, "Shield");
export const Sparkles = make(SparklesIcon, "Sparkles");
export const Star = make(StarIcon, "Star");
export const Tag = make(Tag01Icon, "Tag");
export const Trash2 = make(Delete02Icon, "Trash2");
export const Upload = make(Upload04Icon, "Upload");
export const User = make(UserIcon, "User");
export const UserPlus = make(UserAdd01Icon, "UserPlus");
export const Users = make(UserGroupIcon, "Users");
export const Wand2 = make(MagicWand01Icon, "Wand2");
export const X = make(Cancel01Icon, "X");
export const XCircle = make(CancelCircleIcon, "XCircle");
export const Zap = make(FlashIcon, "Zap");
