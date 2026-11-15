"use client";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
export default function EditorialMotion(){const pathname=usePathname();useEffect(()=>{
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');if(reduced.matches||!('IntersectionObserver'in window))return;
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.setAttribute('data-revealed','true');observer.unobserve(entry.target);}}},{threshold:.08,rootMargin:'0px 0px -24px 0px'});
 function scan(){if(!/^\/(console|organizations|checkout|blue-pro)/.test(pathname)){document.querySelectorAll('main.site-interior>div>section,main.site-interior>article>section').forEach(el=>el.setAttribute('data-reveal',''));}document.querySelectorAll('[data-reveal]:not([data-reveal-ready])').forEach((element,index)=>{element.setAttribute('data-reveal-ready','true');if(element.getBoundingClientRect().top<window.innerHeight){element.setAttribute('data-revealed','true');}else{element.setAttribute('data-reveal-ready','true');(element as HTMLElement).style.setProperty('--reveal-delay',Math.min(index%3*70,140)+'ms');observer.observe(element);}});}
 scan();const mutations=new MutationObserver(scan);mutations.observe(document.body,{childList:true,subtree:true});
 const stop=()=>{if(reduced.matches){document.querySelectorAll('[data-reveal]').forEach(el=>el.setAttribute('data-revealed','true'));observer.disconnect();}};reduced.addEventListener('change',stop);
 return()=>{observer.disconnect();mutations.disconnect();reduced.removeEventListener('change',stop);};
 },[pathname]);return null;}
