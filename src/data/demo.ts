export type DemoProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  category: 'Atasan' | 'Outerwear' | 'Essentials' | 'Aksesori';
  image: string;
  imageAlt: string;
  shade: string;
  sizes: string[];
  stock: number;
  featured?: boolean;
};

const photo = (id: string, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;

export const products: DemoProduct[] = [
  { id:'p01', slug:'cotton-overshirt', name:'Cotton Overshirt', description:'Overshirt katun berstruktur lembut, ringan untuk lapisan sehari-hari. Jahitan rapi dan siluet santai.', price: 289000, category:'Outerwear', image:photo('photo-1591047139829-d91aecb6caea'), imageAlt:'Jaket bergaya kasual', shade:'#dcdad1', sizes:['S','M','L','XL'], stock:18, featured:true },
  { id:'p02', slug:'essential-tee', name:'Essential Tee', description:'Kaos harian dengan potongan modern dan bahan nyaman untuk aktivitas sepanjang hari.', price: 159000, category:'Atasan', image:photo('photo-1503342217505-b0a15ec3261c'), imageAlt:'Atasan dalam fotografi editorial', shade:'#dedad4', sizes:['S','M','L','XL'], stock:29, featured:true },
  { id:'p03', slug:'weekend-shirt', name:'Weekend Shirt', description:'Kemeja santai untuk kesempatan yang terasa sederhana namun tetap rapi.', price: 259000, category:'Atasan', image:photo('photo-1602810318383-e386cc2a3ccf'), imageAlt:'Kemeja bergaya kasual', shade:'#c5bfb5', sizes:['S','M','L','XL'], stock:13, featured:true },
  { id:'p04', slug:'linen-layer', name:'Linen Layer', description:'Lapisan linen yang ringan dengan tampilan clean dan sentuhan tekstur alami.', price: 319000, category:'Outerwear', image:photo('photo-1539109136881-3be0616acf4b'), imageAlt:'Busana model editorial', shade:'#d6d3c9', sizes:['S','M','L'], stock:10 },
  { id:'p05', slug:'everyday-carry', name:'Everyday Carry', description:'Tas ringan berprofil bersih untuk kebutuhan sehari-hari.', price: 219000, category:'Aksesori', image:photo('photo-1547949003-9792a18a2601'), imageAlt:'Tas aksesori harian', shade:'#ded4c8', sizes:['One size'], stock:8 },
  { id:'p06', slug:'relaxed-pants', name:'Relaxed Pants', description:'Celana dengan konstruksi nyaman dan potongan lurus serbaguna.', price: 279000, category:'Essentials', image:photo('photo-1473966968600-fa801b869a1a'), imageAlt:'Padu padan busana sehari-hari', shade:'#d6d1c9', sizes:['S','M','L','XL'], stock:16 },
];

export const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(amount);
export const categories = ['Semua produk', 'Atasan', 'Outerwear', 'Essentials', 'Aksesori'] as const;
export const collectionImage = photo('photo-1483985988355-763728e1935b', 1600);
export const editorialImage = photo('photo-1529139574466-a303027c1d8b', 1400);
export const detailImage = photo('photo-1490481651871-ab68de25d43d', 1300);
