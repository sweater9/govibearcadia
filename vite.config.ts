import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({registerType:'autoUpdate',includeAssets:['favicon.svg'],manifest:{name:'GoVibeArcadia',short_name:'Arcadia',description:'A premium local-first browser arcade.',theme_color:'#090514',background_color:'#090514',display:'standalone',start_url:'/',icons:[{src:'favicon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}})]
})
