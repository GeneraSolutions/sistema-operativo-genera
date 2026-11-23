export type VCardProfile = {
  firstName: string;
  lastName: string;
  fullName: string;
  company: string;
  role: string;
  department?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  website: string;
  bookingUrl?: string;
  avatarUrl: string;
  avatarSize?: number;
  logoUrl: string;
  defaultWaMessage: string;
  tags: string[];
  tagline?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  websiteUrl?: string;
  design?: "genera";
  avatarPosition?: string;
  avatarTop?: string;
};

export const GENERA_TAGLINE =
  "Energía solar para el hogar, el negocio y la industria.";

const GENERA_PUBLIC = {
  company: "Genera Solutions SAS",
  website: "https://www.generasolutionsas.com",
  websiteUrl: "https://www.generasolutionsas.com",
  portfolioUrl: "https://portafolio-genera.vercel.app",
  instagramUrl: "https://www.instagram.com/generasolutions/",
  tiktokUrl: "https://www.tiktok.com/@genera.solutions",
  facebookUrl: "https://www.facebook.com/share/1WTxZpzd4b/",
  logoUrl: "/brand/logo-genera.png?v=2",
  design: "genera" as const,
  tagline: GENERA_TAGLINE,
};

export const PROFILES_DB: Record<string, VCardProfile> = {
  victor: {
    firstName: "Victor",
    lastName: "Cardenas",
    fullName: "Victor Cardenas",
    company: "LUXSUA INGENIERÍA S.A.S.",
    role: "CEO & Director de Estructuración de Proyectos",
    department: "Gerencia",
    phone: "+573021066719",
    whatsappNumber: "573021066719",
    email: "gerencia@luxsua.com",
    website: "https://luxsua.com",
    bookingUrl: "https://calendly.com",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    logoUrl: "https://via.placeholder.com/150x50?text=LOGO",
    defaultWaMessage:
      "Hola Victor, vi tu tarjeta digital y me gustaría cotizar un proyecto.",
    tags: ["Proyectos EPC", "Estructuración PPA", "Generación Distribuida"],
  },
  camilo: {
    firstName: "Camilo",
    lastName: "Rendón",
    fullName: "Camilo Rendón Chacón",
    role: "CEO y Director de Proyectos",
    department: "Dirección Ejecutiva",
    phone: "+573174553288",
    whatsappNumber: "573174553288",
    email: "camilo.rendon@generasolutionsas.com",
    ...GENERA_PUBLIC,
    avatarUrl: "/brand/camilo.jpg?v=5",
    avatarSize: 128,
    avatarPosition: "center 4%",
    avatarTop: "56%",
    defaultWaMessage:
      "Hola Camilo, vi tu tarjeta digital y deseo consultar sobre un proyecto solar.",
    tags: [],
  },
  jhons: {
    firstName: "Jhons",
    lastName: "Sanchez Ospina",
    fullName: "Jhons Sanchez Ospina",
    role: "Técnico/Especialista en sistemas fotovoltaicos",
    phone: "+573142916848",
    whatsappNumber: "573142916848",
    ...GENERA_PUBLIC,
    avatarUrl: "/brand/jhons.jpg?v=4",
    avatarPosition: "center 18%",
    avatarTop: "52%",
    defaultWaMessage:
      "Hola Jhons, vi tu tarjeta digital y deseo consultar sobre un proyecto solar.",
    tags: [],
  },
  tatiana: {
    firstName: "Tatiana",
    lastName: "Ospina Reinoso",
    fullName: "Tatiana Ospina Reinoso",
    role: "Gerente Administrativa",
    phone: "+573027460232",
    whatsappNumber: "573027460232",
    email: "tatiana.ospina@generasolutionsas.com",
    ...GENERA_PUBLIC,
    avatarUrl: "/brand/tatiana.jpg?v=4",
    avatarPosition: "center 14%",
    avatarTop: "50%",
    defaultWaMessage:
      "Hola Tatiana, vi tu tarjeta digital y deseo consultar sobre un proyecto solar.",
    tags: [],
  },
};

export function getVCardProfile(username: string): VCardProfile {
  const key = username.toLowerCase();
  return PROFILES_DB[key] || PROFILES_DB.camilo;
}
