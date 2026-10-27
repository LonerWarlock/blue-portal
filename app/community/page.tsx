import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Code2, GraduationCap, MapPin, MessageCircle, Sparkles, Trophy, Users } from 'lucide-react';
import PageLayout from '@/app/components/PageLayout';
import JsonLd from '@/app/components/JsonLd';
import { canonicalUrl } from '@/lib/seo';
import { communityEvents, communityWinners, heroPhotos } from '@/lib/community';
import PhotoStack from './PhotoStack';
import EventAlbum from './EventAlbum';
import styles from './community.module.css';

const initiatives = [
  { icon: GraduationCap, title: 'Learn, in good company.', description: 'Campus sessions. Live conversations. A place to ask the questions that move you forward.', label: 'Explore our sessions', href: '#pvpit-session' },
  { icon: Code2, title: 'Take on a hackathon.', description: 'Find your team, put an idea to work and see what you can build together.', label: 'Inside our first hackathon', href: '#first-hackathon' },
  { icon: Trophy, title: 'Make your mark.', description: 'Meet the teams behind the wins. Our hackathon winners have a home right here.', label: 'Meet the winners', href: '#winners' },
  { icon: Users, title: 'Bring it to your campus.', description: 'Have a community that wants to build? Talk to Imergene about a session or event.', label: 'Start a conversation', href: '/contact' },
];

const resources = [
  { icon: BookOpen, title: 'Blue documentation', href: '/docs' },
  { icon: Users, title: 'Explore Blue Teams', href: '/teams' },
  { icon: GraduationCap, title: 'Student builder guide', href: '/guides/ai-coding-assistant-for-students' },
  { icon: MessageCircle, title: 'Contact & support', href: '/contact' },
];

export default function CommunityPage() {
  return (
    <PageLayout>
      <div className={styles.community}>
        <JsonLd data={{
          '@context': 'https://schema.org', '@type': 'CollectionPage',
          name: 'Blue Community by Imergene', url: canonicalUrl('/community'),
          description: 'Explore Imergene campus sessions, community hackathons and the Blue community winners showcase.',
          isPartOf: { '@id': `${canonicalUrl('/')}#website` },
          about: { '@id': `${canonicalUrl('/')}#organization` },
          mainEntity: {
            '@type': 'ItemList', itemListElement: communityWinners.map((winner, index) => ({
              '@type': 'ListItem', position: index + 1, name: `${winner.team} — ${winner.event} winners`,
              url: canonicalUrl('/community') + `#${winner.id}`,
            })),
          },
        }} />

        <section className={styles.hero} aria-labelledby="community-title">
          <div className={styles.wrap}>
            <p className={styles.communityBadge}><span aria-hidden="true" /> The Blue community <span className={styles.badgeDivider}>/</span> By Imergene</p>
            <h1 id="community-title">Built with Blue.<br /><span>Better together.</span></h1>
            <p className={styles.heroDescription}>The people behind the projects. The ideas that bring us together.<br className={styles.desktopBreak} /> Join a community that learns, builds and celebrates together.</p>
            <div className={styles.heroActions}>
              <a href="#events" className={styles.primary}>Explore the community <ArrowDown size={17} aria-hidden="true" /></a>
              <a href="#winners" className={styles.textLink}>Meet our winners <ArrowUpRight size={16} aria-hidden="true" /></a>
            </div>
            <PhotoStack photos={heroPhotos} />
            <nav className={styles.sectionNav} aria-label="Community sections">
              <a href="#events">Sessions & hackathons <ArrowDown size={13} aria-hidden="true" /></a>
              <a href="#winners">Our winners <ArrowDown size={13} aria-hidden="true" /></a>
              <a href="#up-next">What&apos;s next <ArrowDown size={13} aria-hidden="true" /></a>
            </nav>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="initiatives-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.label}>A community for builders</p><h2 id="initiatives-title">There&apos;s a place for you here.</h2></div>
            <p>Come curious. Leave with something new.</p>
          </div>
          <div className={styles.initiatives}>
            {initiatives.map(({ icon: Icon, ...item }) => <Link key={item.title} prefetch={false} href={item.href} className={styles.initiativeCard}>
              <span className={styles.initiativeIcon}><Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span>
              <h3>{item.title}</h3><p>{item.description}</p>
              <span className={styles.cardAction}>{item.label}<ArrowRight size={16} aria-hidden="true" /></span>
            </Link>)}
          </div>
          <div className={styles.resourcePanel}>
            <p className={styles.label}>Keep building</p>
            <nav aria-label="Community resources">{resources.map(({ icon: Icon, ...item }) => <Link key={item.href} href={item.href} prefetch={false}>
              <Icon size={16} aria-hidden="true" /><span>{item.title}</span><ArrowUpRight size={14} aria-hidden="true" />
            </Link>)}</nav>
          </div>
        </section>

        <section id="events" className={`${styles.wrap} ${styles.section}`} aria-labelledby="events-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.label}>Our story, so far</p><h2 id="events-title">Real people. Shared moments.</h2></div>
            <span className={styles.countTag}>{String(communityEvents.length).padStart(2, '0')} community gatherings</span>
          </div>
          <div className={styles.events}>{communityEvents.map(event => <EventAlbum key={event.id} event={event} />)}</div>
        </section>

        <section id="winners" className={styles.winnersSection} aria-labelledby="winners-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHeader}>
              <div><p className={styles.label}><Trophy size={14} aria-hidden="true" /> The winners circle</p><h2 id="winners-title">Good ideas deserve the spotlight.</h2></div>
              <p>The teams that turned a challenge into a win.</p>
            </div>
            <div className={styles.winners}>
              {communityWinners.map(winner => <article id={winner.id} key={winner.id} className={styles.winnerCard}>
                <div className={styles.winnerPhoto}>
                  <Image src={winner.photo.src} alt={winner.photo.alt} fill unoptimized sizes="(max-width: 760px) 90vw, 60vw" />
                  <span className={styles.winnerRibbon}><Trophy size={16} aria-hidden="true" />{winner.award}</span>
                </div>
                <div className={styles.winnerBody}>
                  <span className={styles.winnerMedal} aria-hidden="true"><Trophy size={30} strokeWidth={1.4} /></span>
                  <p className={styles.label}>{winner.event}</p>
                  <h3>{winner.team}</h3>
                  {winner.project && <p className={styles.winnerProject}>{winner.project}</p>}
                  <p className={styles.winnerDescription}>{winner.description}</p>
                  <a href={`#${winner.eventId}`} className={styles.albumLink}>See the hackathon moments <ArrowRight size={17} aria-hidden="true" /></a>
                  <div className={styles.winnerFootnote}><Sparkles size={14} aria-hidden="true" /><span>Our first winners. More stories to come.</span></div>
                </div>
              </article>)}
            </div>
          </div>
        </section>

        <section id="up-next" className={`${styles.wrap} ${styles.section}`} aria-labelledby="next-title">
          <div className={styles.sectionHeader}>
            <div><p className={styles.label}>The next chapter</p><h2 id="next-title">See you at the next one.</h2></div>
          </div>
          <div className={styles.nextEvent}>
            <div className={styles.dateTile} aria-label="December 2026"><CalendarDays size={22} aria-hidden="true" /><strong>DEC</strong><span>2026</span></div>
            <div className={styles.nextCopy}><span className={styles.statusTag}>From December onwards</span><h3>More sessions. More hackathons. More you.</h3><p>We&apos;re growing the Imergene community. New events and the next winning teams will be shared here as they&apos;re announced.</p></div>
            <Link href="/contact" prefetch={false} className={styles.secondary}>Get in touch <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.section} ${styles.lastSection}`} aria-labelledby="updates-title">
          <div className={styles.sectionHeader}><div><p className={styles.label}>From the community</p><h2 id="updates-title">The latest chapter, at a glance.</h2></div></div>
          <div className={styles.updates}>
            <a href="#pvpit-session" className={styles.updateCard}><span className={styles.updateCategory}><MapPin size={14} aria-hidden="true" />Campus stories</span><h3>It started at PVPIT, Budhgaon.</h3><p>A look back at Imergene&apos;s first campus session and the people who made it special.</p><span className={styles.cardAction}>Explore the album <ArrowRight size={16} aria-hidden="true" /></span></a>
            <a href="#winners" className={styles.updateCard}><span className={styles.updateCategory}><Trophy size={14} aria-hidden="true" />Winner spotlight</span><h3>HackHers makes history.</h3><p>Our first hackathon. Our first winning team. Meet the first entry in the Blue winners circle.</p><span className={styles.cardAction}>Meet HackHers <ArrowRight size={16} aria-hidden="true" /></span></a>
            <a href="#up-next" className={styles.updateCard}><span className={styles.updateCategory}><CalendarDays size={14} aria-hidden="true" />Looking ahead</span><h3>December is just the beginning.</h3><p>More opportunities to learn, team up and build with the Imergene community are on the way.</p><span className={styles.cardAction}>What&apos;s coming next <ArrowRight size={16} aria-hidden="true" /></span></a>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
