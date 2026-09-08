import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";
import { GraduationCap, Award, BookOpen, Users, CheckCircle2, Star, Sparkles, Building2, Code2, Rocket } from "lucide-react";

export const metadata = {
  title: "Student Training Programs — Blue AI & IMERGENE",
  description: "Practical developer training programs for college students. Hands-on experience in Python, AI-powered coding agents, and real-world project development.",
};

const studentTestimonials = [
  {
    name: "Sanika Krishnat Chabuk",
    college: "The New College, Kolhapur",
    rating: 5,
    quote: "Training was a great learning experience where I gained practical knowledge and improved my technical skills. The guidance and hands-on experience helped me build confidence and understand real-world projects better.",
  },
  {
    name: "Pranali Krishnat Patil",
    college: "The New College, Kolhapur",
    rating: 5,
    quote: "My training experience was very good and useful. During my training, I learned many new things and gained practical knowledge. I improved my technical skills and communication skills, and learned how to work in a team to complete tasks on time.",
  },
  {
    name: "Sanika Santosh Dhuri",
    college: "The New College, Kolhapur",
    rating: 5,
    quote: "This training helped me improve my programming skills and understand how Python is used in real-world projects.",
  },
  {
    name: "Shivani Prakash Patil",
    college: "The New College, Kolhapur",
    rating: 5,
    quote: "The training helped me improve my technical skills, communication, teamwork, and problem-solving abilities.",
  },
  {
    name: "Nisha Ananda Kamble",
    college: "The New College, Kolhapur",
    rating: 5,
    quote: "Our training experience was really good and helpful. We learned a lot of practical things, and the training helped us understand our tasks much better.",
  },
  {
    name: "Apurva Sandip Bhakare",
    college: "The New College, Kolhapur",
    rating: 5,
    quote: "Excellent training experience. Very informative and helpful for improving practical skills.",
  },
];

const programHighlights = [
  {
    icon: Code2,
    title: "Practical Python Development",
    description: "Students learn core programming concepts, data manipulation, file handling, and web framework basics by writing production-grade code.",
  },
  {
    icon: Sparkles,
    title: "AI & Autonomous Coding Agents",
    description: "Hands-on experience with Blue AI agents to accelerate debugging, rapid prototyping, and real-world software architecture.",
  },
  {
    icon: Rocket,
    title: "Real-World Project Building",
    description: "Instead of synthetic tutorials, students work on live portfolio projects from requirement definition to final deployment.",
  },
  {
    icon: Users,
    title: "Team Work & Industry Workflows",
    description: "Fosters Git collaboration, sprint communication, problem-solving, and practical developer practices expected by tech employers.",
  },
];

export default function TrainingPage() {
  return (
    <PageLayout>
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[140px]"></div>
      </div>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-line-strong bg-paper-alt eyebrow mb-6">
              <GraduationCap className="w-4 h-4 text-brand" />
              <span>Developer Training Program</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-display tracking-tight leading-tight text-ink">
              Hands-on Student <br className="hidden sm:inline" />
              <span className="bg-brand bg-clip-text text-transparent">Training & Skill Development</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              As a software company, we provide hands-on industry training to empower students with real-world development skills, practical Python projects, and modern AI coding agent workflows.
            </p>

            {/* Featured College Partner Badge */}
            <div className="mt-10 inline-flex items-center gap-3 px-5 py-3 rounded-xl panel bg-surface border border-line shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-brand" />
              </div>
              <div className="text-left">
                <p className="text-xs eyebrow text-brand">Institutional Spotlight</p>
                <p className="text-sm font-semibold text-ink">
                  Completed Training Batch for Students of <span className="text-brand">The New College, Kolhapur</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Program Stats & Highlights */}
      <section className="py-16 bg-paper-alt border-y border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="eyebrow">// Core Curriculum</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-display font-bold text-ink">
              What Students Gain From Our Training
            </h2>
            <p className="mt-3 text-sm text-ink-muted max-w-2xl mx-auto">
              Designed to bridge the gap between academic theory and industry development standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {programHighlights.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="panel bg-surface p-6 flex flex-col justify-between hover:border-line-strong transition-colors">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-brand" />
                    </div>
                    <h3 className="text-base font-bold text-ink mb-2">{item.title}</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Student Testimonials Section */}
      <section className="py-20 bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand/10 border border-brand/20 text-brand text-xs font-semibold mb-3">
              <Award className="w-3.5 h-3.5" />
              <span>Student Feedback</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-ink">
              Student Reviews &amp; Testimonials
            </h2>
            <p className="mt-3 text-sm sm:text-base text-ink-muted max-w-2xl mx-auto">
              Read how students from <strong className="text-ink">The New College, Kolhapur</strong> experienced our practical training program.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studentTestimonials.map((t, index) => (
              <div
                key={index}
                className="panel bg-surface p-6 flex flex-col justify-between min-h-[220px] hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="mb-4 flex items-center gap-2" aria-label={`${t.rating} out of 5 stars`}>
                    <div className="flex text-amber-500 text-xs tracking-wider">
                      {"★".repeat(t.rating)}
                      {"☆".repeat(5 - t.rating)}
                    </div>
                    <span className="text-xs text-ink-muted font-mono">{t.rating}.0</span>
                  </div>
                  <p className="text-sm text-ink leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-line flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{t.name}</p>
                    <p className="text-xs text-ink-muted">{t.college}</p>
                  </div>
                  <span className="w-7 h-7 rounded-full bg-paper-alt border border-line flex items-center justify-center text-brand text-xs font-bold shrink-0">
                    {t.name.charAt(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Institutional Partnerships Banner */}
      <section className="py-16 bg-paper-alt border-t border-line">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="panel bg-surface p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-semibold mb-4">
              <BookOpen className="w-3.5 h-3.5" />
              <span>For Colleges &amp; Institutions</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-ink mb-4">
              Want to Conduct Student Training at Your Campus?
            </h2>
            
            <p className="text-sm text-ink-muted max-w-2xl mx-auto leading-relaxed mb-8">
              We offer structured practical training modules in Python development, Data Science, and AI coding tools tailored for computer science and engineering students.
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-xs text-ink-faint mb-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-alt border border-line">
                <CheckCircle2 className="w-4 h-4 text-brand" /> Customized College Timelines
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-alt border border-line">
                <CheckCircle2 className="w-4 h-4 text-brand" /> Verified Completion Certificates
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-alt border border-line">
                <CheckCircle2 className="w-4 h-4 text-brand" /> Live Project Guidance
              </span>
            </div>

            <div className="inline-flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl bg-paper-alt border border-line text-xs text-ink">
              <span className="font-semibold text-brand">Get in Touch:</span>
              <span>Email: <a href="mailto:team@imergene.in" className="text-brand underline">team@imergene.in</a></span>
              <span className="hidden sm:inline text-ink-faint">•</span>
              <span>Phone: <a href="tel:+919322611145" className="text-brand underline">+91 93226 11145</a></span>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
