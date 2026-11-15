"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {Menu,X,ArrowUpRight} from 'lucide-react';
import DesktopDownloadLink from './DesktopDownloadLink';
import ThemeToggle from './ThemeToggle';
const links=[{href:'/product/agents',label:'Features'},{href:'/teams',label:'Blue Teams'},{href:'/pricing',label:'Pricing'},{href:'/download',label:'Download'}];
export default function Navbar({signedIn}:{signedIn?:boolean}={}){
 const pathname=usePathname(),[open,setOpen]=useState(false);
 useEffect(()=>setOpen(false),[pathname]);
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[open]);
 const active=(href:string)=>pathname===href||pathname.startsWith(href+'/');
 return <header className="executive-nav"><div className="executive-nav-inner"><Link prefetch={false} href="/" aria-label="Blue by Imergene home" className="executive-wordmark"><Image src="/images/blue-symbol.png" alt="" width={25} height={25} unoptimized priority/><span>Blue</span></Link><nav className="executive-nav-links" aria-label="Primary navigation">{links.map(link=><Link prefetch={false} key={link.href} href={link.href} aria-current={active(link.href)?'page':undefined}>{link.label}</Link>)}</nav><div className="executive-nav-tools"><ThemeToggle/><Link prefetch={false} href="/console" className="executive-account-link" aria-current={active('/console')?'page':undefined}>Console</Link><Link prefetch={false} href="/organizations" className="executive-account-link" aria-current={active('/organizations')?'page':undefined}>Organization</Link><DesktopDownloadLink className="executive-primary">Get Blue <ArrowUpRight size={13}/></DesktopDownloadLink><button type="button" className="executive-menu-toggle" aria-label={open?'Close navigation menu':'Open navigation menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>setOpen(value=>!value)}>{open?<X size={17}/>:<Menu size={17}/>}</button></div></div>{open&&<nav className="executive-mobile-menu" id="mobile-navigation" aria-label="Mobile navigation">{[...links,{href: "/desktop", label: "Blue Desktop"},{href: "/product/agents", label: "Coding agents"},{href:'/console',label:'Personal console'},{href:'/organizations',label:'Organization'},{href:'/docs',label:'Documentation'},{href:'/community',label:'Community'}].map(link=><Link key={link.href} href={link.href} onClick={()=>setOpen(false)} aria-current={active(link.href)?'page':undefined}>{link.label}</Link>)}<DesktopDownloadLink className="executive-primary">Download Blue for Windows <ArrowUpRight size={14}/></DesktopDownloadLink></nav>}</header>;
}
