export type DemoProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  category:
    "Batik" | "Kebaya" | "Busana Muslim" | "Tenun" | "Outerwear" | "Aksesori";
  image: string;
  imageAlt: string;
  shade: string;
  sizes: string[];
  stock: number;
  featured?: boolean;
};

const media = (name: string) => `/images/batiknalaro/${name}.webp`;

export const products: DemoProduct[] = [
  {
    id: "p01",
    slug: "kemeja-batik-sagara",
    name: "Kemeja Batik Sagara",
    description:
      "Motif geometris bernuansa indigo dan cokelat, dengan kerah klasik serta lengan panjang. Padukan dengan celana netral untuk bekerja atau menghadiri acara keluarga.",
    price: 289000,
    category: "Batik",
    image: media("batik"),
    imageAlt:
      "Model pria Indonesia memakai kemeja batik indigo dan cokelat dengan celana krem",
    shade: "#dcdad1",
    sizes: ["S", "M", "L", "XL"],
    stock: 18,
    featured: true,
  },
  {
    id: "p02",
    slug: "kebaya-ivory-laras",
    name: "Kebaya Ivory Laras",
    description:
      "Kebaya ivory dengan detail bordir senada dan siluet sederhana. Cocok dipadukan dengan rok batik untuk momen istimewa. Produk ini berupa atasan kebaya; rok pada foto adalah pelengkap styling.",
    price: 349000,
    category: "Kebaya",
    image: media("kebaya"),
    imageAlt:
      "Model wanita Indonesia memakai kebaya ivory dan rok batik cokelat",
    shade: "#dedad4",
    sizes: ["S", "M", "L", "XL"],
    stock: 12,
    featured: true,
  },
  {
    id: "p03",
    slug: "gamis-sage-ayu",
    name: "Gamis Sage Ayu",
    description:
      "Gamis sage dengan potongan longgar, lengan panjang, dan aksen batik di pergelangan. Tampilan lembut untuk keseharian dan acara keluarga. Hijab pada foto tidak termasuk produk.",
    price: 329000,
    category: "Busana Muslim",
    image: media("muslimah"),
    imageAlt:
      "Model muslimah Indonesia memakai gamis sage dengan hijab taupe di halaman bernuansa hangat",
    shade: "#d3d7c9",
    sizes: ["S", "M", "L", "XL"],
    stock: 13,
    featured: true,
  },
  {
    id: "p04",
    slug: "sarung-tenun-bumi",
    name: "Sarung Tenun Bumi",
    description:
      "Sarung dengan tekstur tenun dan motif geometris bernuansa cokelat, indigo, dan krem. Lipatan kain yang lentur mudah dipadukan dengan kemeja polos maupun batik.",
    price: 219000,
    category: "Tenun",
    image: media("tenun"),
    imageAlt: "Sarung tenun cokelat dan indigo tersampir rapi pada bangku kayu",
    shade: "#d6cabb",
    sizes: ["Satu ukuran"],
    stock: 10,
  },
  {
    id: "p05",
    slug: "jaket-aksen-nusa",
    name: "Jaket Aksen Nusa",
    description:
      "Jaket ringan berwarna charcoal dengan ritsleting depan dan panel batik yang halus. Pilihan lapisan luar untuk perjalanan atau aktivitas santai.",
    price: 319000,
    category: "Outerwear",
    image: media("jacket"),
    imageAlt:
      "Model pria Indonesia memakai jaket charcoal dengan panel batik di dada",
    shade: "#d0cec9",
    sizes: ["S", "M", "L", "XL"],
    stock: 8,
  },
  {
    id: "p06",
    slug: "selendang-tenun-senja",
    name: "Selendang Tenun Senja",
    description:
      "Selendang krem dengan aksen indigo dan terracotta serta ujung berumbai. Pakai sebagai pelengkap busana atau bawa sebagai lapisan ringan saat bepergian.",
    price: 179000,
    category: "Aksesori",
    image: media("scarf"),
    imageAlt:
      "Selendang tenun krem dengan motif indigo dan terracotta pada pedestal ivory",
    shade: "#ded5c9",
    sizes: ["Satu ukuran"],
    stock: 16,
  },
];

export const rupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
export const categories = [
  "Semua produk",
  "Batik",
  "Kebaya",
  "Busana Muslim",
  "Tenun",
  "Outerwear",
  "Aksesori",
] as const;
export const collectionImage = media("muslimah");
export const editorialImage = media("hero");
export const detailImage = media("tenun");
