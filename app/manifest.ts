import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest {
 return {
  id:'/',
  name:'CosmoMemo — idee, pagine e memoria',
  short_name:'CosmoMemo',
  description:'Le tue pagine, i tuoi progetti e la memoria di Claude in un unico spazio personale.',
  lang:'it',
  start_url:'/',
  scope:'/',
  display:'standalone',
  background_color:'#F7F7F5',
  theme_color:'#2B463D',
  icons:[
   {src:'/icons/cosmomemo-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
   {src:'/icons/cosmomemo-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
   {src:'/icons/cosmomemo-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'},
  ],
 };
}
