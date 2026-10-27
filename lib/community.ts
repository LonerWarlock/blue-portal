import { communityPhotos } from './communityPhotos';

export type CommunityPhoto = {
  id: string;
  src: string;
  thumbnail: string;
  width: number;
  height: number;
  alt: string;
};

export type CommunityEvent = {
  id: string;
  number: string;
  category: string;
  title: string;
  location: string;
  description: string;
  cover: CommunityPhoto;
  photos: CommunityPhoto[];
};

function photo(id: keyof typeof communityPhotos, alt: string): CommunityPhoto {
  return { ...communityPhotos[id], alt };
}

// Add future sessions and hackathons here. Dates are deliberately omitted
// until confirmed; file timestamps are not evidence of an event's date.
export const communityEvents: CommunityEvent[] = [
  {
    id: 'pvpit-session', number: '01', category: 'Campus session',
    title: 'Our first session at PVPIT', location: 'PVPIT, Budhgaon',
    description: 'A room full of curious minds. Our first Imergene session brought students together to learn, ask questions and explore building with AI.',
    cover: photo('pvpit-0336', 'Imergene presenting to students during the first session at PVPIT, Budhgaon.'),
    photos: [
      photo('pvpit-0211', 'Students, faculty and the Imergene team together after the PVPIT session.'),
      photo('pvpit-0336', 'A live presentation during the Imergene session at PVPIT.'),
      photo('pvpit-0262', 'The speaker explaining a topic in the PVPIT classroom.'),
      photo('pvpit-0352', 'Students following the Imergene presentation in the classroom.'),
      photo('pvpit-0183', 'The Imergene session in progress at PVPIT, Budhgaon.'),
      photo('pvpit-0213', 'A group photograph of the PVPIT session community.'),
      photo('pvpit-0225', 'PVPIT students and faculty gathered with the Imergene team.'),
      photo('pvpit-0244', 'The community group at the end of the first Imergene session.'),
      photo('pvpit-0250', 'Another group moment from the first Imergene session at PVPIT.'),
      photo('pvpit-0264', 'The presenter discussing the session material at PVPIT.'),
      photo('pvpit-0266', 'The presenter working through the session at the front of the classroom.'),
      photo('pvpit-0268', 'A demonstration on the classroom projection screen at PVPIT.'),
      photo('pvpit-0364', 'A view of students and the presentation from the PVPIT classroom.'),
      photo('pvpit-0369', 'Students taking part in the first Imergene session.'),
      photo('pvpit-0400', 'A memento presentation during the Imergene visit to PVPIT.'),
      photo('pvpit-0442', 'The PVPIT classroom during the first Imergene session.'),
    ],
  },
  {
    id: 'first-hackathon', number: '02', category: 'Hackathon',
    title: 'The first Imergene hackathon', location: 'Imergene community',
    description: 'Ideas became a team effort at our first hackathon. A chance to build, learn from each other and celebrate the people who took on the challenge.',
    cover: photo('hackathon-0071', 'Participants gathered in the classroom during the first Imergene hackathon.'),
    photos: [
      photo('hackathon-0066', 'Hackathon participants and organizers celebrating with certificates.'),
      photo('hackathon-0076', 'HackHers, the first Imergene hackathon winners, with members of the Imergene team.'),
      photo('hackathon-0070', 'A certificate presentation at the first Imergene hackathon.'),
      photo('hackathon-0069', 'Participants and organizers together in the hackathon classroom.'),
      photo('hackathon-0068', 'Hackathon participants receiving their certificates.'),
      photo('hackathon-0071', 'The first Imergene hackathon gathering in progress.'),
      photo('hackathon-0072', 'A presentation to hackathon participants in the classroom.'),
      photo('hackathon-0075', 'Organizers speaking with participants at the first Imergene hackathon.'),
      photo('hackathon-0077', 'A group moment with participants from the first Imergene hackathon.'),
      photo('hackathon-0079', 'A certificate handover during the hackathon celebration.'),
      photo('hackathon-0082', 'A participant receiving a certificate at the first Imergene hackathon.'),
    ],
  },
];

// Append future winning teams here. Do not infer names or project details
// from photographs. An optional project can be added once confirmed.
export const communityWinners: {
  id: string; team: string; award: string; event: string;
  description: string; photo: CommunityPhoto; eventId: string;
  project?: string;
}[] = [
  {
    id: 'hackhers', team: 'HackHers', award: 'First place',
    event: 'First Imergene hackathon', eventId: 'first-hackathon',
    description: 'Meet HackHers, the winning team from our very first hackathon. The first name in our community winners showcase—and the start of many more.',
    photo: photo('hackathon-0076', 'HackHers, winners of the first Imergene hackathon, pictured with the Imergene team.'),
  },
];

export const heroPhotos = [
  { photo: communityEvents[0].photos[0], caption: 'Where it all started', detail: 'PVPIT, Budhgaon' },
  { photo: communityEvents[1].photos[0], caption: 'A little challenge. A lot of possibility.', detail: 'The first Imergene hackathon' },
  { photo: communityEvents[0].cover, caption: 'Learn something. Build something.', detail: 'Our first campus session' },
  { photo: communityWinners[0].photo, caption: 'Meet our first winners', detail: 'HackHers · First Imergene hackathon' },
];
