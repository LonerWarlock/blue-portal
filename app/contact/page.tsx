"use client";

import { useState } from "react";
import PageLayout from "@/app/components/PageLayout";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      setStatus("error");
      setErrorMsg("Please fill out all fields.");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Failed to send message. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setErrorMsg("An unexpected error occurred. Please check your connection.");
    }
  };

  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Connect
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Contact
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Us
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Have questions, feedback, or need business assistance? Reach out to our team.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto">
            <div className="rounded-2xl glass border border-gray-800/80 p-8 md:p-12 shadow-2xl space-y-10 bg-gray-950/40 backdrop-blur-xl">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-100">Get in Touch</h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Blue AI is built by a distributed team of engineers and researchers. For official inquiries, billing questions, or compliance, please reach us using the contact details provided here.
                  </p>

                  <div className="space-y-4 pt-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-950/50 border border-blue-800/30 flex items-center justify-center text-blue-400 mt-1">
                        <i className="fa-solid fa-building text-sm"></i>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Corporate Entity</span>
                        <span className="text-sm text-gray-200 font-semibold">IMERGENE</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-950/50 border border-blue-800/30 flex items-center justify-center text-blue-400 mt-1">
                        <i className="fa-solid fa-user text-sm"></i>
                      </div>

                      <div>
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Co-Founders
                        </span>

                        <a
                          href="https://www.linkedin.com/in/om-karande-087b20287"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-semibold text-gray-200 no-underline hover:text-blue-400 transition-colors"
                        >
                          Om Nilesh Karande
                        </a>

                        <a
                          href="https://www.linkedin.com/in/soham-phatak"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-semibold text-gray-200 no-underline hover:text-blue-400 transition-colors"
                        >
                          Soham Sachin Phatak
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-950/50 border border-blue-800/30 flex items-center justify-center text-blue-400 mt-1">
                        <i className="fa-solid fa-location-dot text-sm"></i>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Registered Office Address</span>
                        <span className="text-sm text-gray-300 block mt-1 leading-relaxed">
                          Samruddhi Nagar, Kupwad Road,<br />
                          Miraj, Sangli,<br />
                          Maharashtra – 416416
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-950/50 border border-blue-800/30 flex items-center justify-center text-blue-400 mt-1">
                        <i className="fa-solid fa-envelope text-sm"></i>
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Email Address</span>
                        <a href="mailto:team.imergene@gmail.com" className="text-sm text-blue-400 hover:underline">
                          team.imergene@gmail.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/40 p-6 rounded-xl border border-gray-800/60">
                  <h3 className="text-lg font-bold text-gray-200 mb-4">Send a Message</h3>

                  {status === "success" && (
                    <div className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                      ✓ Thank you! Your message has been sent successfully.
                    </div>
                  )}

                  {status === "error" && (
                    <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      ⚠ {errorMsg}
                    </div>
                  )}

                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5">Name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5">Message</label>
                      <textarea
                        rows={4}
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="How can we help you?"
                        className="w-full bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={status === "submitting"}
                      className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === "submitting" ? "Sending..." : "Send Message"}
                    </button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
