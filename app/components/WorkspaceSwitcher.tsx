"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {Building2,Check,ChevronDown,Plus,UserRound} from 'lucide-react';
import styles from './workspace-switcher.module.css';
type Workspace={id:string;name:string};
export default function WorkspaceSwitcher({organizations,activeId='personal',disabled=false,onSelect}:{organizations:Workspace[];activeId?:string;disabled?:boolean;onSelect:(id:string)=>void}){
 const [open,setOpen]=useState(false),container=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId();
 const active=organizations.find(o=>o.id===activeId),name=activeId==='personal'?'Personal workspace':active?.name||'Organization';
 useEffect(()=>{setOpen(false);},[activeId,disabled]);
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);const selected=menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');selected?.focus();return()=>document.removeEventListener('pointerdown',outside);},[open]);
 function select(value:string){setOpen(false);trigger.current?.focus();onSelect(value);}
 return <div className={styles.root} ref={container}><button type="button" ref={trigger} className={styles.trigger} aria-label={'Switch workspace: '+name} aria-expanded={open} aria-haspopup="menu" aria-controls={id} disabled={disabled} onClick={()=>setOpen(value=>!value)} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);}}}>{activeId==='personal'?<UserRound size={15}/>:<Building2 size={15}/>}<span>{name}</span><ChevronDown size={13} className={open?styles.expanded:''}/></button>
 {open&&!disabled&&<div ref={menu} role="menu" aria-label="Workspaces" id={id} className={styles.menu} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus();return;}if(e.key==='Tab'){setOpen(false);return;}
  const items=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]')||[]),index=items.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const next=[...items.slice(index+1),...items.slice(0,index+1)].find(item=>item.textContent?.trim().toLowerCase().startsWith(e.key.toLowerCase()));if(next){e.preventDefault();next.focus();}}
 }}><div className={styles.label}>Workspace</div><button type="button" role="menuitemradio" aria-checked={activeId==='personal'} className={styles.item} onClick={()=>select('personal')}><UserRound size={15}/><span>Personal workspace</span>{activeId==='personal'&&<Check size={14}/>}</button>
 {organizations.length>0&&<><div className={styles.divider}/><div className={styles.label}>Organizations</div><div className={styles.list}>{organizations.map(o=><button type="button" key={o.id} role="menuitemradio" aria-checked={o.id===activeId} className={styles.item} onClick={()=>select(o.id)}><Building2 size={15}/><span>{o.name}</span>{o.id===activeId&&<Check size={14}/>}</button>)}</div></>}
 <div className={styles.divider}/><button type="button" role="menuitem" className={styles.item+' '+styles.create} onClick={()=>select('new')}><Plus size={15}/><span>New Organization</span></button></div>}
 </div>;
}
