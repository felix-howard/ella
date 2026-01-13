/**
 * Lucide Icons Re-export
 *
 * Centralized icon exports for the Ella design system.
 * Using Lucide icons with outline/linear style (stroke-width: 1.5-2px)
 *
 * Icon sizes:
 * - Default: 20px (h-5 w-5)
 * - Small: 16px (h-4 w-4)
 * - Large: 24px (h-6 w-6)
 *
 * Usage:
 * import { HomeIcon, UserIcon, ... } from '@ella/ui'
 */

// Navigation & Layout
export {
  Home as HomeIcon,
  Menu as MenuIcon,
  X as CloseIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  ExternalLink as ExternalLinkIcon,
  MoreHorizontal as MoreHorizontalIcon,
  MoreVertical as MoreVerticalIcon,
} from 'lucide-react'

// Actions
export {
  Plus as PlusIcon,
  Minus as MinusIcon,
  Check as CheckIcon,
  Copy as CopyIcon,
  Pencil as EditIcon,
  Trash2 as TrashIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  RefreshCw as RefreshIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  Settings as SettingsIcon,
  LogOut as LogOutIcon,
  LogIn as LogInIcon,
  Send as SendIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateCw as RotateIcon,
  Expand as ExpandIcon,
  Minimize as MinimizeIcon,
} from 'lucide-react'

// Status & Feedback
export {
  AlertCircle as AlertIcon,
  AlertTriangle as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  XCircle as ErrorIcon,
  HelpCircle as HelpIcon,
  Bell as BellIcon,
  Clock as ClockIcon,
  Calendar as CalendarIcon,
  Star as StarIcon,
  Heart as HeartIcon,
  Flag as FlagIcon,
} from 'lucide-react'

// Documents & Files
export {
  File as FileIcon,
  FileText as FileTextIcon,
  Image as ImageIcon,
  Camera as CameraIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Paperclip as AttachmentIcon,
  FileCheck as FileCheckIcon,
  FileX as FileXIcon,
  FileQuestion as FileQuestionIcon,
} from 'lucide-react'

// Users & Communication
export {
  User as UserIcon,
  Users as UsersIcon,
  UserPlus as UserPlusIcon,
  MessageSquare as MessageIcon,
  MessageCircle as ChatIcon,
  Phone as PhoneIcon,
  Mail as MailIcon,
  AtSign as AtSignIcon,
} from 'lucide-react'

// Data & Analytics
export {
  BarChart3 as ChartIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  PieChart as PieChartIcon,
  Activity as ActivityIcon,
  Layers as LayersIcon,
  Database as DatabaseIcon,
} from 'lucide-react'

// Layout & View
export {
  Grid3X3 as GridIcon,
  List as ListIcon,
  Columns as ColumnsIcon,
  LayoutDashboard as DashboardIcon,
  Table as TableIcon,
  Kanban as KanbanIcon,
} from 'lucide-react'

// Tax/Document Specific
export {
  Receipt as ReceiptIcon,
  Wallet as WalletIcon,
  CreditCard as CreditCardIcon,
  DollarSign as DollarIcon,
  Building2 as BuildingIcon,
  Briefcase as BriefcaseIcon,
  ClipboardList as ChecklistIcon,
  ClipboardCheck as ClipboardCheckIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Key as KeyIcon,
  Fingerprint as FingerprintIcon,
  IdCard as IdCardIcon,
} from 'lucide-react'

// Misc
export {
  Loader2 as LoaderIcon,
  Circle as CircleIcon,
  CircleDot as CircleDotIcon,
  Sparkles as SparklesIcon,
  Wand2 as WandIcon,
  Link as LinkIcon,
  Unlink as UnlinkIcon,
  Globe as GlobeIcon,
} from 'lucide-react'

// Re-export the base Icon type for custom icon components
export type { LucideIcon, LucideProps } from 'lucide-react'
