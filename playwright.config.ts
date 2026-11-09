import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',
 fullyParallel:true,
 workers:process.env.CI?2:undefined,
 use:{baseURL:'http://localhost:5173',headless:true,screenshot:'only-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined}},
 webServer:{command:'npm start',url:'http://localhost:5173',reuseExistingServer:!process.env.CI,timeout:30000},
});
