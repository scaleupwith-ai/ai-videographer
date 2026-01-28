"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  Sparkles,
  Zap,
  Video,
  Wand2,
  ArrowRight,
  Check,
  Star,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Wand2,
    title: "AI-Powered Editing",
    description:
      "Automatically generate professional videos with smart scene detection, transitions, and effects.",
  },
  {
    icon: Sparkles,
    title: "TwelveLabs Analysis",
    description:
      "Deep video understanding with chapters, highlights, and intelligent content summaries.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Render videos in minutes, not hours. Our cloud infrastructure handles the heavy lifting.",
  },
  {
    icon: Video,
    title: "Professional Templates",
    description:
      "Start with beautifully designed templates for any use case—product demos, social content, and more.",
  },
];

const testimonials = [
  {
    quote: "Cut our video production time by 80%. Game changer for our marketing team.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "TechFlow",
  },
  {
    quote: "The AI understands exactly what we need. It's like having a video editor on demand.",
    author: "Marcus Rivera",
    role: "Content Creator",
    company: "CreativeHub",
  },
  {
    quote: "Finally, professional videos without the professional price tag.",
    author: "Emily Watson",
    role: "Founder",
    company: "StartupLabs",
  },
];

const pricingFeatures = [
  "Unlimited video uploads",
  "AI-powered analysis",
  "Professional templates",
  "Cloud rendering",
  "4K export quality",
  "Priority support",
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#2A2F38] text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#2A2F38]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00f0ff] flex items-center justify-center">
              <Video className="w-6 h-6 text-[#2A2F38]" />
            </div>
            <span className="text-xl font-bold">AI Videographer</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-[#00f0ff] hover:bg-[#00f0ff]/90 text-[#2A2F38] font-semibold border-0">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00f0ff]/10 via-transparent to-transparent" />
        <div className="absolute top-40 left-1/4 w-96 h-96 bg-[#00f0ff]/15 rounded-full blur-3xl" />
        <div className="absolute top-60 right-1/4 w-80 h-80 bg-[#36454f]/40 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6 px-4 py-2 bg-white/10 text-[#00f0ff] border-[#00f0ff]/30 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 mr-2" />
              Powered by TwelveLabs AI
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold leading-tight mb-6"
          >
            Create stunning videos
            <br />
            <span className="text-[#00f0ff]">
              with AI magic
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-white/60 max-w-2xl mx-auto mb-10"
          >
            Transform your raw footage into professional videos in minutes.
            AI-powered editing, smart templates, and cloud rendering—all in one platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/signup">
              <Button
                size="lg"
                className="px-8 py-6 text-lg bg-[#00f0ff] hover:bg-[#00f0ff]/90 text-[#2A2F38] font-semibold border-0 shadow-lg shadow-[#00f0ff]/25"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Free Trial
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg border-white/20 text-white hover:bg-white/10"
            >
              Watch Demo
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>

          {/* Hero Video Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-16 relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-[#00f0ff]/10">
              <div className="aspect-video bg-gradient-to-br from-[#36454f] to-[#2A2F38] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-[#00f0ff]/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-[#00f0ff]/30">
                    <Play className="w-8 h-8 text-[#00f0ff] ml-1" />
                  </div>
                  <p className="text-white/40">Platform Preview</p>
                </div>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#2A2F38] via-transparent to-transparent" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-white/5 text-white/70 border-white/10">
              Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-white/60 max-w-xl mx-auto">
              Professional video production tools powered by cutting-edge AI technology.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl bg-[#36454f]/50 border border-white/10 hover:border-[#00f0ff]/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#00f0ff]/20 flex items-center justify-center mb-4 group-hover:bg-[#00f0ff]/30 transition-colors">
                  <feature.icon className="w-6 h-6 text-[#00f0ff]" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/60">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent via-[#36454f]/30 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-white/5 text-white/70 border-white/10">
              Testimonials
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Loved by creators</h2>
            <p className="text-white/60">
              See what our users have to say about AI Videographer.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, idx) => (
              <motion.div
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl bg-[#36454f]/50 border border-white/10"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#00f0ff] fill-[#00f0ff]" />
                  ))}
                </div>
                <p className="text-white/80 mb-6 italic">&ldquo;{testimonial.quote}&rdquo;</p>
                <div>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm text-white/50">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2 bg-white/5 text-white/70 border-white/10">
              Pricing
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Simple, credit-based pricing</h2>
            <p className="text-white/60 max-w-xl mx-auto">
              Pay only for what you use. No subscriptions, no hidden fees.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-gradient-to-br from-[#36454f]/80 to-[#36454f]/40 border border-[#00f0ff]/20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00f0ff]/10 rounded-full blur-3xl" />
            
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-[#00f0ff] font-semibold mb-2">Credit-based</p>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-bold">$2</span>
                  <span className="text-white/50">AUD / credit</span>
                </div>
                <p className="text-white/60 mb-6">
                  Start with 1 free credit. Purchase more as you need them.
                </p>
                <Link href="/signup">
                  <Button className="bg-[#00f0ff] hover:bg-[#00f0ff]/90 text-[#2A2F38] font-semibold border-0">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-3">
                {pricingFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#00f0ff]/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-[#00f0ff]" />
                    </div>
                    <span className="text-white/80">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl bg-gradient-to-br from-[#00f0ff]/20 via-[#36454f]/40 to-[#36454f]/20 border border-[#00f0ff]/20 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#00f0ff]/5 to-transparent" />
            <div className="relative">
              <h2 className="text-4xl font-bold mb-4">Ready to create?</h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                Join thousands of creators using AI Videographer to produce stunning content.
              </p>
              <Link href="/signup">
                <Button
                  size="lg"
                  className="px-8 py-6 text-lg bg-[#00f0ff] text-[#2A2F38] hover:bg-[#00f0ff]/90 font-semibold border-0"
                >
                  Start Your Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00f0ff] flex items-center justify-center">
              <Video className="w-5 h-5 text-[#2A2F38]" />
            </div>
            <span className="font-semibold">AI Videographer</span>
          </div>
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} AI Videographer. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-white/60 hover:text-white text-sm">
              Sign In
            </Link>
            <Link href="/signup" className="text-white/60 hover:text-white text-sm">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
