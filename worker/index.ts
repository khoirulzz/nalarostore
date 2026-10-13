/**
 * Nalaro Store Worker: Phase 0 public read-only API.
 * No merchant writes, payments, or production checkout until identity, audit,
 * reservation expiry, load testing and disaster recovery are signed off.
 * Hyperdrive / Aiven PostgreSQL are optional bindings and are NOT provisioned by this repository.
 */
import postgres from 'postgres';

type Env = {
  ASSETS: Fetcher;
  APP_ENV: string;
  ENABLE_LIVE_CHECKOUT: string;
  HYPERDRIVE?: { connectionString: string };
  MEDIA?: R2Bucket;
};
const json = (body: unknown, status=200, headers:Record<string,string>={}) => new Response(JSON.stringify(body),{status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const slugIsValid=(s:string)=>/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(s);

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if(request.method!=='GET')return json({error:'Method not available. Transaksi langsung belum diaktifkan.'},405,{'allow':'GET'});
    if(url.pathname==='/api/health')return json({status:'ok',mode:'foundation',database:env.HYPERDRIVE?'configured':'not-configured',liveCheckout:false});
    if(url.pathname==='/api/public/capabilities')return json({liveCheckout:false,merchantAuth:false,subscriptionBilling:false,customInquiry:false,mediaUploads:false});
    if(url.pathname==='/api/public/plans'){
      if(!env.HYPERDRIVE)return json({plans:[],message:'Belum ada paket yang dipublikasikan.'});
      const sql=postgres(env.HYPERDRIVE.connectionString,{max:1,fetch_types:false,prepare:true,connect_timeout:5,idle_timeout:5});
      try{const plans=await sql`select p.id,p.name,p.description,pr.billing_interval,pr.amount_idr from plans p join plan_prices pr on pr.plan_id=p.id where p.is_public=true and p.status='active' and pr.is_active=true order by p.sort_order,case when pr.billing_interval='monthly' then 1 else 2 end`;return json({plans});}
      catch(e){console.error('plans API query failed');return json({error:'Layanan belum tersedia.'},503);}finally{await sql.end({timeout:1});}
    }
    const match=url.pathname.match(/^\/api\/public\/stores\/([^/]+)(?:\/(products))?\/?$/);
    if(match){
      const slug=decodeURIComponent(match[1]);
      if(!slugIsValid(slug))return json({error:'Toko tidak ditemukan.'},404);
      if(!env.HYPERDRIVE)return json({error:'Database belum dikonfigurasi.'},503);
      const sql=postgres(env.HYPERDRIVE.connectionString,{max:1,fetch_types:false,prepare:true,connect_timeout:5,idle_timeout:5});
      try{
        const found=await sql`select id,slug,name,description,theme_key from stores where slug=${slug} and status='published' limit 1`;
        if(found.length===0)return json({error:'Toko tidak ditemukan.'},404);
        const store=found[0];
        if(match[2]==='products'){
          const rows=await sql`select p.id,p.slug,p.name,p.description,p.price_idr,p.category,p.primary_image_url,v.id as variant_id,v.sku,v.option_label,v.price_override_idr,(v.stock_qty - v.reserved_qty) as available_stock from products p join product_variants v on v.product_id=p.id and v.store_id=p.store_id where p.store_id=${store.id} and p.status='active' order by p.position asc,p.created_at desc limit 60`;
          return json({store:{slug:store.slug,name:store.name},products:rows},200,{'cache-control':'public,max-age=20'});
        }
        return json({store:{slug:store.slug,name:store.name,description:store.description,theme:store.theme_key}});
      }catch(e){console.error('storefront API query failed');return json({error:'Layanan toko sedang tidak tersedia.'},503);}
      finally{await sql.end({timeout:1});}
    }
    return json({error:'Endpoint tidak ditemukan.'},404);
  }
} satisfies ExportedHandler<Env>;
