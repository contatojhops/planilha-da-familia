import {
  Baby, Banknote, Book, Briefcase, Building, Bus, Car, CreditCard, Dog, Droplet,
  Dumbbell, FileText, Flame, Gift, GraduationCap, Handshake, HeartPulse, Home,
  Landmark, Laptop, PartyPopper, Pizza, PiggyBank, Plane, PlusCircle, Scissors,
  Shield, Shirt, ShoppingCart, Smartphone, Sparkles, Stethoscope, TrendingUp,
  Tv, Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet, briefcase: Briefcase, "trending-up": TrendingUp, home: Home,
  "plus-circle": PlusCircle, "graduation-cap": GraduationCap, "heart-pulse": HeartPulse,
  car: Car, shield: Shield, tv: Tv, "shopping-cart": ShoppingCart,
  "party-popper": PartyPopper, shirt: Shirt, scissors: Scissors, gift: Gift,
  wrench: Wrench, "credit-card": CreditCard, landmark: Landmark, building: Building,
  handshake: Handshake, "file-text": FileText, droplet: Droplet, zap: Zap,
  flame: Flame, wifi: Wifi, utensils: Utensils, pizza: Pizza, plane: Plane,
  bus: Bus, dog: Dog, baby: Baby, book: Book, laptop: Laptop, smartphone: Smartphone,
  dumbbell: Dumbbell, stethoscope: Stethoscope, "piggy-bank": PiggyBank,
  banknote: Banknote, sparkles: Sparkles,
};

export const ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Sparkles;
}

export const CATEGORY_COLORS = [
  "#0f766e", "#14b8a6", "#0ea5e9", "#3b82f6", "#1e3a5f", "#6366f1",
  "#8b5cf6", "#d946ef", "#e11d48", "#b91c1c", "#f97316", "#f59e0b",
  "#eab308", "#65a30d", "#16a34a", "#64748b",
];

/** Categorias criadas pelo seed padrão da família. */
export const DEFAULT_CATEGORY_NAMES = new Set([
  "Salário", "Freelance/Autônomo", "Rendimentos de investimento", "Aluguel recebido",
  "Outras receitas", "Moradia", "Educação", "Saúde", "Transporte", "Seguros",
  "Assinaturas", "Alimentação/Mercado", "Lazer", "Vestuário", "Cuidados pessoais",
  "Presentes", "Manutenção casa/carro", "Cartão de crédito", "Empréstimos",
  "Financiamentos", "Consórcio", "Contas", "Água", "Luz", "Gás", "Internet",
]);
