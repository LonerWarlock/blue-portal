"use client";
import {useEffect,useRef,useState} from 'react';
import {Pause,Play,Volume2,VolumeX,ArrowUpRight} from 'lucide-react';
import styles from './executive-home.module.css';
export default function TeamsPromoVideo({src='/videos/blue-desktop-website.mp4',poster='/videos/blue-desktop-website-poster.jpg',label='Blue Desktop product demonstration'}:{src?:string;poster?:string;label?:string}={}){
 const video=useRef<HTMLVideoElement>(null),[playing,setPlaying]=useState(false),[muted,setMuted]=useState(true),[failed,setFailed]=useState(false);
 useEffect(()=>{const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');const apply=()=>{if(reduce.matches)video.current?.pause();};apply();reduce.addEventListener('change',apply);return()=>reduce.removeEventListener('change',apply);},[]);
 async function togglePlay(){const player=video.current;if(!player)return;if(player.paused){try{await player.play();}catch{setPlaying(false);}}else player.pause();}
 return <div className={styles.videoFrame}><div className={styles.windowBar}><span><i/><i/><i/></span><p>BLUE / THE WORKSPACE</p><span>One goal. A whole team.</span></div><div className={styles.videoSurface}>
  <video ref={video} src={src} poster={poster} autoPlay muted={muted} loop playsInline preload="metadata" controls={failed} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>setFailed(true)} aria-label={label}><a href={src}>Watch the Blue product demonstration</a></video>
  <div className={styles.videoControls}><button type="button" onClick={()=>void togglePlay()} aria-label={playing?'Pause product video':'Play product video'}>{playing?<Pause size={14}/>:<Play size={14}/>}<span>{playing?'Pause':'Play'}</span></button><span/><button type="button" onClick={()=>setMuted(value=>!value)} aria-label={muted?'Unmute product video':'Mute product video'}>{muted?<VolumeX size={15}/>:<Volume2 size={15}/>}<span>{muted?'Sound off':'Sound on'}</span></button></div>
  {failed&&<p className={styles.videoFallback}>Your browser could not play this video. <a href={src}>Open the MP4 <ArrowUpRight size={13}/></a></p>}
 </div></div>;
}
