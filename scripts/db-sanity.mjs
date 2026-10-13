import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const sql=readFileSync(new URL('../db/0001_foundation.sql',import.meta.url),'utf8');
for(const table of ['stores','products','product_variants','orders','order_items','plans','plan_prices','store_subscriptions','custom_project_leads'])assert(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`${table} table not declared`);
for(const flag of ["monthly","yearly","UNIQUE(store_id,idempotency_key)","reserved_qty<=stock_qty"])assert(sql.includes(flag),`Critical schema requirement missing: ${flag}`);
console.log('Foundation schema presence checks passed. Apply migration and test on a disposable PostgreSQL instance before production.');
