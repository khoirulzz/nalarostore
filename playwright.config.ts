import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/browser',fullyParallel:false,workers:1,use:{baseURL:'http://localhost:5173',browserName:'chromium'},webServer:{command:'npm run dev:full',url:'http://localhost:5173',reuseExistingServer:!process.env.CI},reporter:'list'});
